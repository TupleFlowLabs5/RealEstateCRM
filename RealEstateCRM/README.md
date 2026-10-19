# Estateflow CRM

A responsive property sales CRM dashboard for real-estate teams. Built with React, TypeScript, Express, Prisma, and PostgreSQL.

## What’s included

- Lead capture, ownership, source and project attribution, lifecycle stages, search, and updates
- Team members, targets, and channel partner performance views
- Project-aware site visit scheduling and booking records
- Overview and performance reports, plus configurable workflow automations
- A Prisma schema and seed script for PostgreSQL persistence

## Start locally

Use Node.js 20+ and PostgreSQL 14+. Create the `estateflow` PostgreSQL database, copy `.env.example` to `.env`, and update `DATABASE_URL` for your PostgreSQL user and connection.

```bash
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

The Vite client runs at <http://localhost:5173> and forwards `/api` requests to the Express server at <http://localhost:3001>. If the database has not been configured, the sample dashboard remains usable and lead entry still appears immediately in the current session; database writes become persistent when the PostgreSQL-backed API is running.

## Deploy on Vercel

The repo includes `vercel.json`: Vercel builds the Vite client into `dist`, serves the Express API as a Node.js function for `/api/*`, and falls back to the SPA for page routes. Import the repository into Vercel and keep the project root at this directory. The configured build command generates Prisma Client and builds the app.

1. Provision a PostgreSQL database through a Vercel Marketplace integration or another PostgreSQL provider. Vercel Postgres is no longer offered for new projects.
2. Add the provider’s PostgreSQL connection string as `DATABASE_URL` in the Vercel project’s Production and Preview environment variables. For serverless deployments, use the provider’s pooled connection URL when available.
3. Apply the schema migrations against that database with `pnpm run db:deploy`, then deploy the project.

The `.env` file is for local use only; add secrets in Vercel’s Environment Variables settings and do not commit them. The hosted API needs a reachable PostgreSQL database to save CRM records.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Server and PostgreSQL health |
| GET | `/api/overview` | CRM KPI counts and booked value |
| GET / POST | `/api/leads` | List/search leads and add a lead |
| PATCH | `/api/leads/:id` | Update lead fields or stage |
| GET | `/api/projects` | List portfolio projects |
| GET / POST | `/api/partners` | List and add channel partners |
| GET / POST | `/api/visits` | List and schedule a site visit |
| GET / POST | `/api/bookings` | List bookings and confirm a booking |
| GET / POST / PATCH | `/api/automations` | List, create, or toggle automations |

All CRM records persist to PostgreSQL through Prisma. Seed data is idempotent and safe to rerun. Currency values are shown in Indian rupees.
