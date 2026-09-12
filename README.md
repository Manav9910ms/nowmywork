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
- Firebase Authentication foundation
- Email/password sign-up and sign-in
- Google sign-in
- Role selection during onboarding
- Authenticated dashboard shell

## Firebase setup

1. Create or open a Firebase project.
2. In Firebase Console, enable Authentication and turn on **Email/Password** and **Google** providers.
3. Register a Web App in the Firebase project.
4. Copy the web app configuration into the `NEXT_PUBLIC_FIREBASE_*` variables in `.env`.
5. Add your local and deployed domains to Firebase Authentication's authorized domains.

The client SDK handles browser authentication. Never put Firebase Admin credentials in `NEXT_PUBLIC_*` variables. Server-side token verification will be added when protected API routes are connected to authenticated users.

## Run locally

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and Firebase variables in .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## Auth routes

- `/signup` — create an account and choose Client or Freelancer
- `/signin` — email/password or Google sign-in
- `/dashboard` — authenticated dashboard shell

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
