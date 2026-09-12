# NowMyWork

**Work should find you.**

NowMyWork is a freelance marketplace built around matching instead of endless bidding.

## Product loop

1. A client posts a project.
2. The platform evaluates skills, tech stack, budget, deadline, priority and freelancer availability.
3. The best eligible freelancers receive a private opportunity.
4. A suitable freelancer accepts and the project is assigned.
5. NowMyWork earns a transaction commission.

## MVP foundation

- Next.js App Router + TypeScript
- PostgreSQL + Prisma schema
- Client / freelancer / admin role model
- Freelancer profile and availability model
- Job and private offer model
- Rule-based top-10 matching engine
- Matching API preview endpoint
- Job posting API foundation
- Vercel-friendly Node.js API runtime

## Run locally

```bash
npm install
cp .env.example .env
# Set DATABASE_URL in .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## APIs

- `GET /api/health` — deployment health check
- `POST /api/jobs` — create a client job
- `POST /api/matching` — score candidates and return the top 10

The matching engine is deliberately rule-based in the first MVP so it can be tested with real marketplace behaviour before adding AI scoring.

## Branding

- `icon.png` — transparent background icon
- `logo.png` — white-background logo

## Deployment

The application is designed for deployment on Vercel. The database is external PostgreSQL and is configured through `DATABASE_URL`.
