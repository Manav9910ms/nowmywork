# NowMyWork

**Work should find you.**

NowMyWork is a freelance marketplace built around private matching instead of proposal and bidding wars.

## Marketplace loop

1. A client posts a project with requirements, budget, duration and priority.
2. NowMyWork filters freelancers by mandatory skills and availability, then scores eligible candidates.
3. The configurable top N matches receive private offers and in-app notifications.
4. A freelancer accepts or declines. Assignment is decided server-side with an atomic Firestore transaction.
5. The assigned client and freelancer get a project workspace with status, payment and project-specific messaging.
6. Reviews, disputes and marketplace settlement are designed as later production layers.

## Current stack

- Next.js App Router + TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK for trusted server-side operations
- Firestore Security Rules
- Zod runtime validation
- Rule-based, AI-ready matching engine
- Razorpay Live Mode client-fee payment flow
- Vercel deployment

This repository intentionally remains a modular monolith. The matching function is isolated so a future rules + historical outcomes + AI/ML ranker can replace the current scorer without redesigning the marketplace.

## Current working areas

### Authentication

- Email/password signup and sign-in
- Google sign-in
- Client/freelancer role selection at signup
- Email verification on email signup
- Password reset flow
- Persistent Firebase browser session

### Client

- Protected job creation API
- Budget, duration, required skills, tech stack and priority
- Client-side dashboard with job list
- Secure server-triggered matching

### Freelancer

- Protected profile API
- Skills, tech stack, rate, experience, portfolio URL and availability
- Private opportunity list
- Secure accept/decline API
- Server-side atomic assignment

### Matching

Required skills are hard eligibility requirements. BUSY freelancers are excluded. Scores are normalized to 0–100 and include reasons such as skill fit, tech fit, availability, experience, budget compatibility and reliability signals.

The candidate limit is configured with `MATCH_CANDIDATE_LIMIT` and defaults to 10.

### Project workspace

- Server-enforced job status transitions
- Freelancer start and submit actions
- Client approval/completion action
- Project-specific messaging API and UI
- In-app notification center

### Payments

NowMyWork uses **Razorpay Live Mode** for client platform-fee collection. The server requires a Live Mode key (`rzp_live_*`), creates the order server-side, verifies the Razorpay checkout signature, and confirms the payment is captured for the expected INR amount before recording payment status.

Marketplace fees are configuration-driven:

- `CLIENT_FEE_PERCENT` — default 5%
- `FREELANCER_FEE_PERCENT` — default 10%

These percentages describe platform fees, not guaranteed profit. Live freelancer payouts/transfers, settlement reconciliation and production dispute handling are not yet complete.

## Server environment

Copy `.env.example` to `.env.local` and fill the required production values.

For Vercel Production, configure:

- `RAZORPAY_KEY_ID` — **Live Mode** key beginning with `rzp_live_`
- `RAZORPAY_KEY_SECRET` — matching Live Mode secret

The server rejects Test Mode keys. Never commit Firebase service-account private keys or payment secrets.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Firebase setup

1. Enable Firebase Authentication with Email/Password and Google.
2. Create the Cloud Firestore database.
3. Register the web app and configure `NEXT_PUBLIC_FIREBASE_*` variables.
4. Create a Firebase service account for server-side Admin SDK use and put its values only in server environment variables.
5. Publish `firestore.rules`.
6. Add the production site domain to Firebase Authentication authorized domains.

## Razorpay Live Mode setup

1. Activate Live Mode in the Razorpay Dashboard and generate the Live API key pair.
2. Put the Live key ID and Live key secret into Vercel Production environment variables.
3. `RAZORPAY_KEY_ID` must begin with `rzp_live_`; Test Mode keys are rejected by the application.
4. Redeploy the production deployment after changing the environment variables.
5. Configure and verify Razorpay webhook handling before relying on asynchronous payment events in production.

Razorpay Standard Checkout orders are created on the server, and successful payments are verified on the server before NowMyWork records the payment. Live marketplace transfers/payouts require the appropriate Razorpay marketplace/transfer setup and are separate from client checkout collection.

## Data model currently used

The working MVP uses Firestore collections rather than Prisma/PostgreSQL. Existing collections include:

- `users/{uid}` — identity and role
- `clients/{uid}` — client profile
- `freelancers/{uid}` — freelancer profile and matching signals
- `jobs/{jobId}` — project requirements and lifecycle state
- `offers/{jobId_freelancerId}` — private opportunities
- `notifications/{id}` — in-app notifications
- `messages/{id}` — project-specific communication
- `paymentSessions/{jobId}` — payment state
- `paymentParties/{id}` and `contactUnlocks/{jobId}` — protected payment/contact workflow

## Security model

Sensitive marketplace actions are server-controlled with Firebase Admin token verification and role checks. The browser is not trusted for roles, project ownership, assignment results, fee calculation or payment verification.

Offer acceptance and project status changes are validated against current database state. Matching and job creation APIs perform runtime validation before writes.

## Branding

- `icon.png` — transparent-background NowMyWork icon
- `logo.png` — white-background NowMyWork logo

The app uses these repository assets directly rather than remote GitHub image URLs for product UI.

## SEO

The public site includes metadata, sitemap and robots configuration. Authenticated dashboard/project areas are disallowed from indexing.

## Testing and CI

GitHub Actions is configured in `.github/workflows/ci.yml` to run dependency installation, TypeScript checking, unit tests and a production build on pushes and pull requests targeting `main`.

## Production status

The client-side Razorpay checkout path is now configured for Live Mode and explicitly rejects Test Mode keys. A full public marketplace launch still requires production-grade freelancer payout/transfer settlement, webhook-driven payment lifecycle and idempotency across all payment events, file upload/storage authorization, milestone payment orchestration, reviews/reliability calculations from completed history, disputes/admin case management, cancellation/refund workflows, richer client profile/settings, email/push notifications, full end-to-end/browser tests, rate limiting/WAF strategy, and an operational seed/demo environment.
