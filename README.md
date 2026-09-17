# NowMyWork

**Work should find you.**

NowMyWork is a freelance marketplace built around private matching instead of proposal and bidding wars.

## Marketplace loop

1. A client posts a project with requirements, budget, duration, optional deadline and priority.
2. NowMyWork filters freelancers by mandatory skills and availability, then scores eligible candidates.
3. The configurable top N matches receive private offers and in-app notifications.
4. A freelancer accepts or declines. Assignment is decided server-side with an atomic Firestore transaction.
5. The assigned client and freelancer get a project workspace with status, payment and project-specific messaging.
6. Client platform-fee payments are verified through Razorpay and reflected through both immediate API verification and webhook events.

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

The repository remains a modular monolith. Matching is isolated so a future rules + historical outcomes + AI/ML ranker can replace the current scorer without redesigning the marketplace.

## Authentication

- Email/password signup and sign-in
- Google sign-in
- Client/freelancer role selection at signup
- Email verification on email signup
- Password reset flow
- Persistent Firebase browser session
- Server-side Firebase ID-token verification
- Server-side role validation

## Client

- Protected server-side job creation
- Budget, duration, optional deadline, required skills, tech stack and priority
- Client dashboard with project list
- Secure matching trigger
- Project workspace and status workflow

## Freelancer

- Protected profile API
- Skills, tech stack, rate, experience, portfolio URL and availability
- Private opportunity list
- Secure accept/decline API
- Atomic assignment
- Availability is switched to BUSY when assigned and restored to AVAILABLE on terminal completion/cancellation

## Matching

Required skills are hard eligibility requirements. BUSY and unknown availability states are excluded. Scores are normalized to 0–100 and include reasons such as skill fit, tech fit, availability, experience, budget compatibility and reliability signals.

The candidate limit is configured with `MATCH_CANDIDATE_LIMIT` and defaults to 10. Rematching safely supersedes stale pending offers that are no longer in the selected set.

## Project lifecycle

`DRAFT → OPEN → MATCHING → OFFERED → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED`

Cancellation and dispute states are also supported. Status changes are server-enforced through a centralized transition table.

## Payments — Razorpay Live Mode only

NowMyWork uses **Razorpay Live Mode** for client platform-fee collection. The server rejects Test Mode keys and requires `RAZORPAY_KEY_ID` to begin with `rzp_live_`.

The payment flow:

1. Server validates the authenticated client and the assigned project.
2. Server creates a Razorpay order for the configured client platform fee.
3. Checkout uses the server-created order ID.
4. The client callback is verified server-side using the Razorpay signature and a server-side payment fetch.
5. Razorpay webhook events update the stored payment state idempotently.

Webhook events are protected with a separate `RAZORPAY_WEBHOOK_SECRET` and the Razorpay event ID is used for duplicate-event protection.

Marketplace fee configuration:

- `CLIENT_FEE_PERCENT` — default 5%
- `FREELANCER_FEE_PERCENT` — default 10%

These are platform-fee percentages, not guaranteed profit. Freelancer payout/transfer settlement is not automated by this checkout integration yet.

## Environment variables

Copy `.env.example` to `.env.local` and fill the required values.

For Vercel Production configure the Firebase browser/server variables plus:

- `RAZORPAY_KEY_ID` — Live Mode key beginning with `rzp_live_`
- `RAZORPAY_KEY_SECRET` — matching Live Mode secret
- `RAZORPAY_WEBHOOK_SECRET` — separate secret configured for the Razorpay Live webhook
- `CLIENT_FEE_PERCENT`
- `FREELANCER_FEE_PERCENT`
- `MATCH_CANDIDATE_LIMIT`

Never commit Firebase private keys or payment secrets.

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
4. Create a Firebase service account and keep its values only in server environment variables.
5. Publish `firestore.rules`.
6. Add the production site domain to Firebase Authentication authorized domains.

Client job, offer, notification, message, profile and payment-session writes are server-controlled. Firestore rules block direct writes for these marketplace collections.

## Razorpay Live webhook setup

Configure the Live webhook endpoint:

`https://nowmywork.com/api/payments/webhook`

Use the same `RAZORPAY_WEBHOOK_SECRET` value in the Razorpay Live webhook configuration and Vercel Production environment. Subscribe to the payment events needed by the current flow, including captured, authorized, failed and refunded events.

Razorpay webhook signatures must be calculated from the raw request body. Duplicate events should be handled using the unique webhook event ID, and webhook processing must not assume events always arrive in order.

## Firestore collections

- `users/{uid}` — identity and role
- `clients/{uid}` — client profile
- `freelancers/{uid}` — freelancer profile and matching signals
- `jobs/{jobId}` — project requirements and lifecycle state
- `offers/{jobId_freelancerId}` — private opportunities
- `notifications/{id}` — in-app notifications
- `messages/{id}` — project-specific communication
- `paymentSessions/{jobId}` — payment state
- `paymentParties/{id}` — server-side participant contact data
- `contactUnlocks/{jobId}` — server-generated contact access data
- `paymentWebhookEvents/{hash}` — webhook idempotency/audit records

## Security model

Sensitive marketplace actions are server-controlled with Firebase Admin token verification and explicit role checks. The browser is not trusted for roles, project ownership, assignment results, fee calculation or payment verification.

Firestore rules block direct marketplace writes, keep freelancer profiles private to their owners, and protect contact data behind paid-project access.

## Branding

- `icon.png` — transparent-background NowMyWork icon
- `logo.png` — white-background NowMyWork logo

The app uses these repository assets directly.

## SEO

The public site includes metadata, sitemap and robots configuration. Authenticated dashboard/project areas are disallowed from indexing.

## Testing and CI

GitHub Actions runs dependency installation, TypeScript checking, unit tests and the production build on pushes and pull requests targeting `main`.

Current unit coverage includes job state transitions, matching rules and Razorpay Live-key enforcement.

## Production status

The current repository has a verified production build and Live Mode payment integration for the client platform fee. A full marketplace launch still needs production-grade freelancer payout/transfer settlement, refund workflow UI, milestone payments, reviews/reliability calculations from completed history, disputes/admin case management, richer client settings, external notifications, file storage, rate limiting/WAF strategy and end-to-end browser testing.
