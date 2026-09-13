# NowMyWork

**Work should find you.**

NowMyWork is a freelance marketplace built around matching instead of endless bidding.

## Product loop

1. A client posts a project.
2. The platform evaluates skills, tech stack, budget, deadline, priority and freelancer availability.
3. The best eligible freelancers receive a private opportunity.
4. A suitable freelancer accepts and the project is assigned.
5. NowMyWork earns a transaction commission.

## Current stack

- Next.js App Router + TypeScript
- Firebase Authentication
- Cloud Firestore
- Firestore Security Rules
- Rule-based top-10 matching engine
- Vercel deployment

Firebase Authentication handles browser sign-in. Cloud Firestore stores application data, including user profiles, freelancer profiles, jobs and private offers. The application does not require PostgreSQL, Prisma, Firebase Admin SDK, or server-side private-key credentials.

## Firebase setup

1. Create or open the Firebase project.
2. Enable Authentication and turn on **Email/Password** and **Google** providers.
3. Create a **Cloud Firestore** database.
4. Register a Web App in the Firebase project.
5. Copy the web app configuration into the `NEXT_PUBLIC_FIREBASE_*` variables.
6. Publish `firestore.rules` as the Firestore Rules for the `(default)` database.
7. Add `nowmywork.com` and `www.nowmywork.com` to Firebase Authentication's authorized domains.

Never put service-account private keys in `NEXT_PUBLIC_*` variables. This project intentionally does not require Firebase Admin credentials for the current client-side Firestore architecture.

## Firestore data model

- `users/{uid}` — account identity, display name and role
- `freelancers/{uid}` — freelancer profile, skills, tech stack, availability and rating fields
- `jobs/{jobId}` — client project information and matching preferences
- `offers/{offerId}` — private freelancer opportunities and response state

The repository contains `firestore.rules` with ownership and role checks for these collections.

## Run locally

```bash
npm install
cp .env.example .env.local
# Set the NEXT_PUBLIC_FIREBASE_* variables
npm run dev
```

Open `http://localhost:3000`.

## Auth routes

- `/signup` — create an account and choose Client or Freelancer
- `/signin` — email/password or Google sign-in
- `/dashboard` — authenticated dashboard shell

## Matching

`lib/matching.ts` contains the initial rule-based scoring engine. It evaluates skill fit, tech-stack fit, rating, experience, completed jobs, availability and budget fit, with different weights for the client's **Quality First**, **Balanced**, or **Speed/Budget First** preference.

## Security

Firestore Rules are part of the repository in `firestore.rules`. Publish them to Firebase before using the database in production. The rules prevent users from changing their role after account creation and restrict profile/job writes to the owning authenticated user.

## Branding

- `icon.png` — transparent background icon
- `logo.png` — white-background logo

## Deployment

The application is designed for deployment on Vercel. Firebase provides authentication and Firestore data storage; Vercel only needs the public Firebase Web App environment variables.
