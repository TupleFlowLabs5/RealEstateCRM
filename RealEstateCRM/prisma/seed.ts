import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await Promise.all([
    { name: 'The Willow Residences', location: 'Whitefield, Bengaluru', priceFrom: 9200000, image: 'willow' },
    { name: 'Parkview Heights', location: 'Hinjewadi, Pune', priceFrom: 6800000, image: 'parkview' },
    { name: 'Olive Garden Villas', location: 'Sarjapur Road, Bengaluru', priceFrom: 18500000, image: 'olive' },
    { name: 'Meridian Business Park', location: 'BKC, Mumbai', priceFrom: 24500000, image: 'meridian' },
  ].map(project => prisma.project.upsert({ where: { name: project.name }, update: project, create: project })))

  const team = await Promise.all([
    { name: 'Rohan Mehta', email: 'rohan@estateflow.example', role: 'MANAGER' as const, avatar: 'RM' },
    { name: 'Priya Nair', email: 'priya@estateflow.example', role: 'AGENT' as const, avatar: 'PN' },
    { name: 'Kabir Sethi', email: 'kabir@estateflow.example', role: 'AGENT' as const, avatar: 'KS' },
    { name: 'Rhea Kapoor', email: 'rhea@estateflow.example', role: 'ADMIN' as const, avatar: 'RK' },
  ].map(user => prisma.user.upsert({ where: { email: user.email }, update: user, create: user })))

  const partners = await Promise.all([
    { name: 'Aarav Gupta', company: 'Aarav Group', email: 'hello@aaravgroup.example', commissionRate: 2.5 },
    { name: 'Hina Malhotra', company: 'HomeMatch Realty', email: 'partners@homematch.example', commissionRate: 2.5 },
    { name: 'Chetan Arora', company: 'Cityscape Advisors', email: 'team@cityscape.example', commissionRate: 2.25 },
  ].map(partner => prisma.channelPartner.upsert({ where: { company: partner.company }, update: partner, create: partner })))

  const people = [
    ['Ananya Sharma','ananya.s@email.com','+91 98765 42101','Instagram','QUALIFIED',14500000,projects[0].id,team[0].id],
    ['Arjun Kapoor','arjun.k@email.com','+91 87654 32109','Referral','SITE_VISIT',9200000,projects[1].id,team[1].id],
    ['Meera Iyer','meera.iyer@email.com','+91 76543 21098','99acres','CONTACTED',18500000,projects[0].id,team[2].id],
    ['Vikram Patel','vikram.p@email.com','+91 65432 10987','Website','NEGOTIATION',23200000,projects[2].id,team[0].id],
    ['Riya Desai','riya.d@email.com','+91 98760 54321','Channel partner','NEW',31000000,projects[3].id,team[1].id],
    ['Dev Malhotra','dev.m@email.com','+91 87650 12345','Facebook','QUALIFIED',11800000,projects[1].id,team[2].id],
    ['Aditi Rao','aditi.rao@email.com','+91 99887 66554','Referral','NEW',12500000,projects[0].id,team[1].id],
    ['Nikhil Shah','nikhil.s@email.com','+91 88776 55443','Channel partner','QUALIFIED',21000000,projects[2].id,team[0].id],
  ] as const

  for (let index = 0; index < people.length; index++) {
    const [name,email,phone,source,status,budget,projectId,assignedToId] = people[index]
    const lead = await prisma.lead.upsert({ where: { email }, update: { name, phone, source, status, budget, projectId, assignedToId }, create: { name,email,phone,source,status,budget,projectId,assignedToId,channelPartnerId: source === 'Channel partner' ? partners[index % partners.length].id : undefined } })
    const startsAt = new Date(); startsAt.setDate(startsAt.getDate() + index % 7 + 1); startsAt.setHours(10 + index % 6, 30, 0, 0)
    if (index < 4) await prisma.siteVisit.upsert({ where: { id: `seed-visit-${index}` }, update: { leadId: lead.id, projectId, agentId: assignedToId, startsAt }, create: { id: `seed-visit-${index}`, leadId: lead.id, projectId, agentId: assignedToId, startsAt } })
  }

  const flows = [
    { name: 'A warm welcome', trigger: 'New lead comes in', description: 'Send a friendly first hello within 2 minutes.', runsThisMonth: 284 },
    { name: 'A gentle nudge', trigger: 'No reply after 2 days', description: 'Remind the owner to reach out, with a note.', runsThisMonth: 2146 },
    { name: 'Visit-day reminder', trigger: 'A visit is tomorrow', description: 'Send the buyer the where, when, and a warm note.', runsThisMonth: 68 },
    { name: 'The good news', trigger: 'A booking is confirmed', description: 'Let the whole team share in the happy moment.', runsThisMonth: 32 },
  ]
  for (const flow of flows) await prisma.automation.upsert({ where: { id: `seed-${flow.name.toLowerCase().replace(/\W+/g, '-')}` }, update: flow, create: { id: `seed-${flow.name.toLowerCase().replace(/\W+/g, '-')}`, ...flow, active: flow.name !== 'Visit-day reminder' } })
  console.log(`Seeded ${projects.length} projects, ${team.length} users, ${partners.length} partners, ${people.length} leads, and ${flows.length} automations.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
