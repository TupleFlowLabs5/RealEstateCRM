# Estateflow CRM

A responsive property sales CRM dashboard for real-estate teams. Built with React, TypeScript, Express, Prisma, and PostgreSQL.

## What’s included

- Lead capture, ownership, source and project attribution, lifecycle stages, search, and updates
- Team members, targets, and channel partner performance views
- Project-aware site visit scheduling and booking records
- Overview and performance reports, plus configurable workflow automations
- A Prisma schema and seed script for PostgreSQL persistence

## Workspace modules

Register or log in at `/` to open the Leads workspace. Sign-in uses a browser-session cookie, so closing the browser ends the client session; the **Log out** control also ends the session and returns to `/`. Accounts are stored separately from sales-team members, passwords are hashed, and CRM API routes require a valid session. The Marketing & Sales dashboard remains available at `/marketing-sales`; inventory uses the existing project records at `/Inventory`.

## Start locally

Use Node.js 20+ and Docker Compose. The included Compose file runs PostgreSQL 16 locally with a persistent volume.

```bash
npm install
npm run db:generate
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), then start PostgreSQL and initialize the schema with seed data:

```bash
docker compose up -d db
npm run db:setup
npm run dev
```

The Vite client runs at <http://localhost:5173> and forwards `/api` requests to the Express server at <http://localhost:3001>. Leads and the other CRM records are stored in PostgreSQL through Prisma; the seeded sample records make the dashboard immediately usable. The Compose volume preserves data when the database container is stopped or restarted. To stop PostgreSQL without deleting data, run `docker compose down`; to permanently remove the local database and its data, run `docker compose down -v`.

Set `DATABASE_URL` in `.env` to use another PostgreSQL instance. Keep credentials out of source control.

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
