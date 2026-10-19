import express from 'express'
import cors from 'cors'
import { Prisma, PrismaClient } from '@prisma/client'

const app = express()
export const prisma = new PrismaClient()
app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'connected' }) }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }) }
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
  const { name, email, phone, source, budget, notes, projectName, assignedToId, channelPartnerId } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim()) { res.status(400).json({ error: 'A lead name is required.' }); return }
  try {
    const lead = await prisma.lead.create({ data: { name: name.trim(), email: cleanOptional(email), phone: cleanOptional(phone), source: cleanOptional(source) ?? 'Website', budget: typeof budget === 'number' && Number.isFinite(budget) ? budget : null, notes: cleanOptional(notes), ...(typeof assignedToId === 'string' ? { assignedTo: { connect: { id: assignedToId } } } : {}), ...(typeof channelPartnerId === 'string' ? { channelPartner: { connect: { id: channelPartnerId } } } : {}), ...(typeof projectName === 'string' ? { project: { connect: { name: projectName } } } : {}) }, include: { project: true, assignedTo: true, channelPartner: true } })
    res.status(201).json(lead)
  } catch (error) { handleError(res, error) }
})

app.patch('/api/leads/:id', async (req, res) => {
  const { name, email, phone, status, budget, source, notes, assignedToId, projectId } = req.body ?? {}
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { ...(typeof name === 'string' ? { name } : {}), ...(typeof email === 'string' ? { email } : email === null ? { email: null } : {}), ...(typeof phone === 'string' ? { phone } : phone === null ? { phone: null } : {}), ...(typeof source === 'string' ? { source } : {}), ...(typeof status === 'string' ? { status: status.toUpperCase().replace(' ', '_') as Prisma.EnumLeadStatusFieldUpdateOperationsInput['set'] } : {}), ...(typeof budget === 'number' ? { budget } : {}), ...(typeof notes === 'string' ? { notes } : {}), ...(typeof assignedToId === 'string' ? { assignedTo: { connect: { id: assignedToId } } } : {}), ...(typeof projectId === 'string' ? { project: { connect: { id: projectId } } } : {}) }, include: { project: true, assignedTo: true } })
    res.json(lead)
  } catch (error) { handleError(res, error) }
})

app.get('/api/projects', async (_req, res) => { try { res.json(await prisma.project.findMany({ include: { _count: { select: { leads: true, bookings: true } } }, orderBy: { name: 'asc' } })) } catch (error) { handleError(res, error) } })
app.get('/api/partners', async (_req, res) => { try { res.json(await prisma.channelPartner.findMany({ include: { _count: { select: { leads: true } } }, orderBy: { createdAt: 'desc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/partners', async (req, res) => { const { name, company, email, phone, commissionRate } = req.body ?? {}; if (typeof name !== 'string' || !name.trim() || typeof company !== 'string' || !company.trim()) { res.status(400).json({ error: 'Partner name and company are required.' }); return }; try { res.status(201).json(await prisma.channelPartner.create({ data: { name: name.trim(), company: company.trim(), email: cleanOptional(email), phone: cleanOptional(phone), ...(typeof commissionRate === 'number' ? { commissionRate } : {}) } })) } catch (error) { handleError(res, error) } })
app.get('/api/visits', async (_req, res) => { try { res.json(await prisma.siteVisit.findMany({ include: { lead: true, project: true, agent: true }, orderBy: { startsAt: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/visits', async (req, res) => { const { leadId, projectId, startsAt, agentId, notes } = req.body ?? {}; if (typeof leadId !== 'string' || typeof projectId !== 'string' || !startsAt || Number.isNaN(Date.parse(startsAt))) { res.status(400).json({ error: 'A lead, project, and valid visit time are required.' }); return }; try { res.status(201).json(await prisma.siteVisit.create({ data: { leadId, projectId, startsAt: new Date(startsAt), ...(typeof agentId === 'string' ? { agentId } : {}), notes: cleanOptional(notes) }, include: { lead: true, project: true, agent: true } })) } catch (error) { handleError(res, error) } })
app.get('/api/bookings', async (_req, res) => { try { res.json(await prisma.booking.findMany({ include: { lead: true, project: true, agent: true }, orderBy: { bookedAt: 'desc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/bookings', async (req, res) => { const { leadId, projectId, unitNumber, amount, agentId } = req.body ?? {}; if (typeof leadId !== 'string' || typeof projectId !== 'string' || typeof unitNumber !== 'string' || typeof amount !== 'number') { res.status(400).json({ error: 'Lead, project, unit number, and booking amount are required.' }); return }; try { const booking = await prisma.$transaction(async tx => { const created = await tx.booking.create({ data: { leadId, projectId, unitNumber, amount, ...(typeof agentId === 'string' ? { agentId } : {}) }, include: { lead: true, project: true, agent: true } }); await tx.lead.update({ where: { id: leadId }, data: { status: 'WON' } }); return created }); res.status(201).json(booking) } catch (error) { handleError(res, error) } })
app.get('/api/automations', async (_req, res) => { try { res.json(await prisma.automation.findMany({ orderBy: { createdAt: 'asc' } })) } catch (error) { handleError(res, error) } })
app.post('/api/automations', async (req, res) => { const { name, trigger, description } = req.body ?? {}; if (typeof name !== 'string' || typeof trigger !== 'string' || typeof description !== 'string') { res.status(400).json({ error: 'Automation name, trigger, and description are required.' }); return }; try { res.status(201).json(await prisma.automation.create({ data: { name, trigger, description } })) } catch (error) { handleError(res, error) } })
app.patch('/api/automations/:id', async (req, res) => { try { res.json(await prisma.automation.update({ where: { id: req.params.id }, data: { ...(typeof req.body.active === 'boolean' ? { active: req.body.active } : {}) } })) } catch (error) { handleError(res, error) } })

function cleanOptional(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function handleError(res: express.Response, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(404).json({ error: 'The requested CRM record was not found.' }); return }
  console.error(error)
  res.status(500).json({ error: 'CRM request failed. Check the database connection and request details.' })
}

export default app
