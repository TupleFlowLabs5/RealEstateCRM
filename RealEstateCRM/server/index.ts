import app, { prisma } from './app'

const port = Number(process.env.PORT) || 3001
const server = app.listen(port, () => console.log(`Estateflow CRM API ready on http://localhost:${port}`))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  }))
}
