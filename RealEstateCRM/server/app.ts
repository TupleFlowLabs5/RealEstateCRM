import express from 'express'
import cors from 'cors'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { BookingStatus, LeadStatus, Prisma, PrismaClient, UserRole, VisitStatus } from '@prisma/client'

const app = express()
export const prisma = new PrismaClient()
app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'connected' }) }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }) }
})

const scryptAsync = promisify(scrypt)
const sessionCookie = 'estateflow_session'
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000

function hashSessionToken(token: string) { return createHash('sha256').update(token).digest('hex') }
function cookieOptions(maxAge?: number) {
  return [`${sessionCookie}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', ...(maxAge === undefined ? [] : [`Max-Age=${maxAge}`]), ...(process.env.NODE_ENV === 'production' ? ['Secure'] : [])].join('; ')
}
function readSessionToken(req: express.Request) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`))
  return cookie?.slice(sessionCookie.length + 1) || null
}
async function issueSession(accountId: string, res: express.Response) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  await prisma.authSession.create({ data: { accountId, tokenHash: hashSessionToken(token), expiresAt } })
  res.setHeader('Set-Cookie', cookieOptions().replace(`${sessionCookie}=`, `${sessionCookie}=${token}`))
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100
    || typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Enter your name, a valid email address, and a password between 8 and 128 characters.' })
    return
  }
  try {
    const salt = randomBytes(16)
    const derived = await scryptAsync(password, salt, 64) as Buffer
    const account = await prisma.account.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: `scrypt$${salt.toString('hex')}$${derived.toString('hex')}` } })
    await issueSession(account.id, res)
    res.status(201).json({ user: { id: account.id, name: account.name, email: account.email } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'An account with this email already exists. Log in instead.' })
      return
    }
    handleError(res, error)
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) {
    res.status(400).json({ error: 'Enter a valid email address and password.' })
    return
  }
  try {
    const account = await prisma.account.findUnique({ where: { email: email.trim().toLowerCase() } })
    const parts = account?.passwordHash.split('$')
    let passwordMatches = false
    if (parts?.length === 3 && parts[0] === 'scrypt' && /^[\da-f]{32}$/.test(parts[1]) && /^[\da-f]{128}$/.test(parts[2])) {
      const expected = Buffer.from(parts[2], 'hex')
      const actual = await scryptAsync(password, Buffer.from(parts[1], 'hex'), expected.length) as Buffer
      passwordMatches = timingSafeEqual(actual, expected)
    }
    if (!account || !passwordMatches) {
      res.status(401).json({ error: 'Email or password is incorrect.' })
      return
    }
    await issueSession(account.id, res)
    res.json({ user: { id: account.id, name: account.name, email: account.email } })
  } catch (error) { handleError(res, error) }
})

app.get('/api/auth/session', async (req, res) => {
  const token = readSessionToken(req)
  if (!token) { res.json({ user: null }); return }
  try {
    const session = await prisma.authSession.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { account: true } })
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.authSession.delete({ where: { id: session.id } })
      res.setHeader('Set-Cookie', cookieOptions(0))
      res.json({ user: null })
      return
    }
    res.json({ user: { id: session.account.id, name: session.account.name, email: session.account.email } })
  } catch (error) { handleError(res, error) }
})

app.post('/api/auth/logout', async (req, res) => {
  const token = readSessionToken(req)
  try {
    if (token) await prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    res.setHeader('Set-Cookie', cookieOptions(0))
    res.status(204).end()
  } catch (error) { handleError(res, error) }
})

app.use('/api', async (req, res, next) => {
  const token = readSessionToken(req)
  if (!token) { res.status(401).json({ error: 'Sign in to access your workspace.' }); return }
  try {
    const session = await prisma.authSession.findUnique({ where: { tokenHash: hashSessionToken(token) } })
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.authSession.delete({ where: { id: session.id } })
      res.setHeader('Set-Cookie', cookieOptions(0))
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
      return
    }
    next()
  } catch (error) {
    console.error('Failed to validate workspace session.', error)
    res.status(500).json({ error: 'Could not validate your session.' })
  }
})

app.get('/api/overview', async (_req, res) => {
  try {
    const [leads, visits, bookings, value] = await Promise.all([
      prisma.lead.count(), prisma.siteVisit.count({ where: { status: 'SCHEDULED' } }),
      prisma.booking.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.booking.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { amount: true } }),
    ])
    res.json({ leads, visits, bookings, bookedValue: value._sum.amount ?? 0 })
  } catch (error) { handleError(res, error) }
})

app.get('/api/leads', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status.toUpperCase().replace(' ', '_') : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const rows = await prisma.lead.findMany({ where: { ...(status ? { status: status as Prisma.EnumLeadStatusFilter['equals'] } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, include: { project: true, assignedTo: true, channelPartner: true }, orderBy: { createdAt: 'desc' } })
    res.json(rows)
  } catch (error) { handleError(res, error) }
})

app.post('/api/leads', async (req, res) => {
  const { name, email, phone, source, status, budget, notes, projectName, projectId, assignedToId, channelPartnerId } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim()) { res.status(400).json({ error: 'A lead name is required.' }); return }
  if (status !== undefined && (typeof status !== 'string' || !Object.values(LeadStatus).includes(status as LeadStatus))) { res.status(400).json({ error: 'Choose a valid lead status.' }); return }
  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0)) { res.status(400).json({ error: 'Enter a valid lead budget.' }); return }
  try {
    const lead = await prisma.lead.create({ data: { name: name.trim(), email: cleanOptional(email), phone: cleanOptional(phone), source: cleanOptional(source) ?? 'Website', ...(typeof status === 'string' ? { status: status as LeadStatus } : {}), budget: typeof budget === 'number' && Number.isFinite(budget) ? budget : null, notes: cleanOptional(notes), ...(typeof assignedToId === 'string' && assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}), ...(typeof channelPartnerId === 'string' && channelPartnerId ? { channelPartner: { connect: { id: channelPartnerId } } } : {}), ...(typeof projectId === 'string' && projectId ? { project: { connect: { id: projectId } } } : typeof projectName === 'string' && projectName ? { project: { connect: { name: projectName } } } : {}) }, include: { project: true, assignedTo: true, channelPartner: true } })
    res.status(201).json(lead)
  } catch (error) { handleError(res, error) }
})

app.patch('/api/leads/:id', async (req, res) => {
  const { name, email, phone, status, budget, source, notes, assignedToId, projectId, channelPartnerId } = req.body ?? {}
  if (typeof status === 'string' && !Object.values(LeadStatus).includes(status.toUpperCase().replace(' ', '_') as LeadStatus)) { res.status(400).json({ error: 'Choose a valid lead status.' }); return }
  if (budget !== undefined && budget !== null && (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0)) { res.status(400).json({ error: 'Enter a valid lead budget.' }); return }
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { ...(typeof name === 'string' ? { name: name.trim() } : {}), ...(typeof email === 'string' ? { email: cleanOptional(email) } : email === null ? { email: null } : {}), ...(typeof phone === 'string' ? { phone: cleanOptional(phone) } : phone === null ? { phone: null } : {}), ...(typeof source === 'string' ? { source: source.trim() } : {}), ...(typeof status === 'string' ? { status: status.toUpperCase().replace(' ', '_') as LeadStatus } : {}), ...(typeof budget === 'number' && Number.isFinite(budget) ? { budget } : budget === null ? { budget: null } : {}), ...(typeof notes === 'string' ? { notes: cleanOptional(notes) } : notes === null ? { notes: null } : {}), ...(typeof assignedToId === 'string' ? { assignedTo: assignedToId ? { connect: { id: assignedToId } } : { disconnect: true } } : assignedToId === null ? { assignedTo: { disconnect: true } } : {}), ...(typeof projectId === 'string' ? { project: projectId ? { connect: { id: projectId } } : { disconnect: true } } : projectId === null ? { project: { disconnect: true } } : {}), ...(typeof channelPartnerId === 'string' ? { channelPartner: channelPartnerId ? { connect: { id: channelPartnerId } } : { disconnect: true } } : channelPartnerId === null ? { channelPartner: { disconnect: true } } : {}) }, include: { project: true, assignedTo: true, channelPartner: true } })
    res.json(lead)
  } catch (error) { handleError(res, error) }
})

app.get('/api/users', async (_req, res) => { try { res.json(await prisma.user.findMany({ include: { _count: { select: { leads: true } } }, orderBy: { name: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/users', async (req, res) => {
  const { name, email, role, avatar } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) { res.status(400).json({ error: 'Team member name and email are required.' }); return }
  if (role !== undefined && !Object.values(UserRole).includes(role)) { res.status(400).json({ error: 'Choose a valid team member role.' }); return }
  try { res.status(201).json(await prisma.user.create({ data: { name: name.trim(), email: email.trim(), ...(role ? { role } : {}), avatar: cleanOptional(avatar) } })) } catch (error) { handleError(res, error) }
})
app.patch('/api/users/:id', async (req, res) => {
  const { name, email, role, avatar } = req.body ?? {}
  if (typeof role === 'string' && !Object.values(UserRole).includes(role as UserRole)) { res.status(400).json({ error: 'Choose a valid team member role.' }); return }
  if (name !== undefined && (typeof name !== 'string' || !name.trim()) || email !== undefined && (typeof email !== 'string' || !email.trim())) { res.status(400).json({ error: 'Team member name and email cannot be empty.' }); return }
  try { res.json(await prisma.user.update({ where: { id: req.params.id }, data: { ...(typeof name === 'string' ? { name: name.trim() } : {}), ...(typeof email === 'string' ? { email: email.trim() } : {}), ...(typeof role === 'string' ? { role: role as UserRole } : {}), ...(typeof avatar === 'string' ? { avatar: cleanOptional(avatar) } : {}) } })) } catch (error) { handleError(res, error) }
})

app.get('/api/projects', async (_req, res) => { try { res.json(await prisma.project.findMany({ include: { _count: { select: { leads: true, bookings: true } } }, orderBy: { name: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/projects', async (req, res) => {
  const { name, location, priceFrom, status, image } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim() || typeof location !== 'string' || !location.trim() || typeof priceFrom !== 'number' || !Number.isFinite(priceFrom) || priceFrom < 0) { res.status(400).json({ error: 'Project name, location, and a valid starting price are required.' }); return }
  try { res.status(201).json(await prisma.project.create({ data: { name: name.trim(), location: location.trim(), priceFrom, ...(typeof status === 'string' && status.trim() ? { status: status.trim() } : {}), image: cleanOptional(image) } })) } catch (error) { handleError(res, error) }
})
app.patch('/api/projects/:id', async (req, res) => {
  const { name, location, priceFrom, status, image } = req.body ?? {}
  if (priceFrom !== undefined && (typeof priceFrom !== 'number' || !Number.isFinite(priceFrom) || priceFrom < 0)) { res.status(400).json({ error: 'Enter a valid project starting price.' }); return }
  if (name !== undefined && (typeof name !== 'string' || !name.trim()) || location !== undefined && (typeof location !== 'string' || !location.trim())) { res.status(400).json({ error: 'Project name and location cannot be empty.' }); return }
  try { res.json(await prisma.project.update({ where: { id: req.params.id }, data: { ...(typeof name === 'string' ? { name: name.trim() } : {}), ...(typeof location === 'string' ? { location: location.trim() } : {}), ...(typeof priceFrom === 'number' ? { priceFrom } : {}), ...(typeof status === 'string' && status.trim() ? { status: status.trim() } : {}), ...(typeof image === 'string' ? { image: cleanOptional(image) } : {}) } })) } catch (error) { handleError(res, error) }
})
app.get('/api/partners', async (_req, res) => { try { res.json(await prisma.channelPartner.findMany({ include: { _count: { select: { leads: true } } }, orderBy: { createdAt: 'desc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/partners', async (req, res) => { const { name, company, email, phone, commissionRate } = req.body ?? {}; if (typeof name !== 'string' || !name.trim() || typeof company !== 'string' || !company.trim()) { res.status(400).json({ error: 'Partner name and company are required.' }); return }; if (commissionRate !== undefined && (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate) || commissionRate < 0)) { res.status(400).json({ error: 'Enter a valid partner commission rate.' }); return }; try { res.status(201).json(await prisma.channelPartner.create({ data: { name: name.trim(), company: company.trim(), email: cleanOptional(email), phone: cleanOptional(phone), ...(typeof commissionRate === 'number' ? { commissionRate } : {}) } })) } catch (error) { handleError(res, error) } })
app.patch('/api/partners/:id', async (req, res) => {
  const { name, company, email, phone, commissionRate } = req.body ?? {}
  if (name !== undefined && (typeof name !== 'string' || !name.trim()) || company !== undefined && (typeof company !== 'string' || !company.trim())) { res.status(400).json({ error: 'Partner name and company cannot be empty.' }); return }
  if (commissionRate !== undefined && (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate) || commissionRate < 0)) { res.status(400).json({ error: 'Enter a valid partner commission rate.' }); return }
  try { res.json(await prisma.channelPartner.update({ where: { id: req.params.id }, data: { ...(typeof name === 'string' ? { name: name.trim() } : {}), ...(typeof company === 'string' ? { company: company.trim() } : {}), ...(typeof email === 'string' ? { email: cleanOptional(email) } : email === null ? { email: null } : {}), ...(typeof phone === 'string' ? { phone: cleanOptional(phone) } : phone === null ? { phone: null } : {}), ...(typeof commissionRate === 'number' ? { commissionRate } : {}) } })) } catch (error) { handleError(res, error) }
})
app.get('/api/visits', async (_req, res) => { try { res.json(await prisma.siteVisit.findMany({ include: { lead: true, project: true, agent: true }, orderBy: { startsAt: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/visits', async (req, res) => { const { leadId, projectId, startsAt, agentId, notes, status } = req.body ?? {}; if (typeof leadId !== 'string' || !leadId || typeof projectId !== 'string' || !projectId || !startsAt || Number.isNaN(Date.parse(startsAt))) { res.status(400).json({ error: 'A lead, project, and valid visit time are required.' }); return }; if (status !== undefined && !Object.values(VisitStatus).includes(status)) { res.status(400).json({ error: 'Choose a valid site visit status.' }); return }; try { res.status(201).json(await prisma.siteVisit.create({ data: { leadId, projectId, startsAt: new Date(startsAt), ...(typeof agentId === 'string' && agentId ? { agentId } : {}), notes: cleanOptional(notes), ...(status ? { status } : {}) }, include: { lead: true, project: true, agent: true } })) } catch (error) { handleError(res, error) } })
app.patch('/api/visits/:id', async (req, res) => {
  const { leadId, projectId, startsAt, agentId, notes, status } = req.body ?? {}
  if (startsAt !== undefined && (typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt)))) { res.status(400).json({ error: 'Enter a valid site visit date and time.' }); return }
  if (status !== undefined && (typeof status !== 'string' || !Object.values(VisitStatus).includes(status as VisitStatus))) { res.status(400).json({ error: 'Choose a valid site visit status.' }); return }
  try { res.json(await prisma.siteVisit.update({ where: { id: req.params.id }, data: { ...(typeof leadId === 'string' ? { lead: { connect: { id: leadId } } } : {}), ...(typeof projectId === 'string' ? { project: { connect: { id: projectId } } } : {}), ...(typeof startsAt === 'string' ? { startsAt: new Date(startsAt) } : {}), ...(typeof agentId === 'string' ? { agent: agentId ? { connect: { id: agentId } } : { disconnect: true } } : agentId === null ? { agent: { disconnect: true } } : {}), ...(typeof notes === 'string' ? { notes: cleanOptional(notes) } : notes === null ? { notes: null } : {}), ...(typeof status === 'string' ? { status: status as VisitStatus } : {}) }, include: { lead: true, project: true, agent: true } })) } catch (error) { handleError(res, error) }
})
app.get('/api/bookings', async (_req, res) => { try { res.json(await prisma.booking.findMany({ include: { lead: true, project: true, agent: true }, orderBy: { bookedAt: 'desc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/bookings', async (req, res) => { const { leadId, projectId, unitNumber, amount, agentId, status, bookedAt } = req.body ?? {}; if (typeof leadId !== 'string' || !leadId || typeof projectId !== 'string' || !projectId || typeof unitNumber !== 'string' || !unitNumber.trim() || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) { res.status(400).json({ error: 'Lead, project, unit number, and valid booking amount are required.' }); return }; if (status !== undefined && !Object.values(BookingStatus).includes(status)) { res.status(400).json({ error: 'Choose a valid booking status.' }); return }; if (bookedAt !== undefined && (typeof bookedAt !== 'string' || Number.isNaN(Date.parse(bookedAt)))) { res.status(400).json({ error: 'Enter a valid booking date.' }); return }; try { const booking = await prisma.$transaction(async tx => { const created = await tx.booking.create({ data: { leadId, projectId, unitNumber: unitNumber.trim(), amount, ...(typeof agentId === 'string' && agentId ? { agentId } : {}), ...(status ? { status } : {}), ...(typeof bookedAt === 'string' ? { bookedAt: new Date(bookedAt) } : {}) }, include: { lead: true, project: true, agent: true } }); await tx.lead.update({ where: { id: leadId }, data: { status: 'WON' } }); return created }); res.status(201).json(booking) } catch (error) { handleError(res, error) } })
app.patch('/api/bookings/:id', async (req, res) => {
  const { leadId, projectId, unitNumber, amount, agentId, status, bookedAt } = req.body ?? {}
  if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) { res.status(400).json({ error: 'Enter a valid booking amount.' }); return }
  if (unitNumber !== undefined && (typeof unitNumber !== 'string' || !unitNumber.trim())) { res.status(400).json({ error: 'Unit number cannot be empty.' }); return }
  if (status !== undefined && (typeof status !== 'string' || !Object.values(BookingStatus).includes(status as BookingStatus))) { res.status(400).json({ error: 'Choose a valid booking status.' }); return }
  if (bookedAt !== undefined && (typeof bookedAt !== 'string' || Number.isNaN(Date.parse(bookedAt)))) { res.status(400).json({ error: 'Enter a valid booking date.' }); return }
  try { res.json(await prisma.booking.update({ where: { id: req.params.id }, data: { ...(typeof leadId === 'string' ? { lead: { connect: { id: leadId } } } : {}), ...(typeof projectId === 'string' ? { project: { connect: { id: projectId } } } : {}), ...(typeof unitNumber === 'string' ? { unitNumber: unitNumber.trim() } : {}), ...(typeof amount === 'number' ? { amount } : {}), ...(typeof agentId === 'string' ? { agent: agentId ? { connect: { id: agentId } } : { disconnect: true } } : agentId === null ? { agent: { disconnect: true } } : {}), ...(typeof status === 'string' ? { status: status as BookingStatus } : {}), ...(typeof bookedAt === 'string' ? { bookedAt: new Date(bookedAt) } : {}) }, include: { lead: true, project: true, agent: true } })) } catch (error) { handleError(res, error) }
})
app.get('/api/automations', async (_req, res) => { try { res.json(await prisma.automation.findMany({ orderBy: { createdAt: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/automations', async (req, res) => {
  const { name, trigger, description, active, runsThisMonth } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim() || typeof trigger !== 'string' || !trigger.trim() || typeof description !== 'string' || !description.trim()) { res.status(400).json({ error: 'Automation name, trigger, and description are required.' }); return }
  if (active !== undefined && typeof active !== 'boolean' || runsThisMonth !== undefined && (!Number.isInteger(runsThisMonth) || runsThisMonth < 0)) { res.status(400).json({ error: 'Enter a valid automation status and run count.' }); return }
  try { res.status(201).json(await prisma.automation.create({ data: { name: name.trim(), trigger: trigger.trim(), description: description.trim(), ...(typeof active === 'boolean' ? { active } : {}), ...(typeof runsThisMonth === 'number' ? { runsThisMonth } : {}) } })) } catch (error) { handleError(res, error) }
})
app.patch('/api/automations/:id', async (req, res) => {
  const { name, trigger, description, active, runsThisMonth } = req.body ?? {}
  if (name !== undefined && (typeof name !== 'string' || !name.trim()) || trigger !== undefined && (typeof trigger !== 'string' || !trigger.trim()) || description !== undefined && (typeof description !== 'string' || !description.trim())) { res.status(400).json({ error: 'Automation name, trigger, and description cannot be empty.' }); return }
  if (runsThisMonth !== undefined && (!Number.isInteger(runsThisMonth) || runsThisMonth < 0)) { res.status(400).json({ error: 'Enter a valid automation run count.' }); return }
  try {
    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: {
        ...(typeof name === 'string' ? { name: name.trim() } : {}),
        ...(typeof trigger === 'string' ? { trigger: trigger.trim() } : {}),
        ...(typeof description === 'string' ? { description: description.trim() } : {}),
        ...(typeof active === 'boolean' ? { active } : {}),
        ...(typeof runsThisMonth === 'number' ? { runsThisMonth } : {}),
      },
    })
    res.json(automation)
  } catch (error) { handleError(res, error) }
})

function cleanOptional(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function handleError(res: express.Response, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(404).json({ error: 'The requested CRM record was not found.' }); return }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.status(409).json({ error: 'A record with this unique name, company, or email already exists.' }); return }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') { res.status(400).json({ error: 'Choose an existing related lead, project, partner, or team member.' }); return }
  console.error(error)
  res.status(500).json({ error: 'CRM request failed. Check the database connection and request details.' })
}

export default app
