## AI Context Manager

Next.js 14 App Router project that assembles structured AI context templates, supports authenticated cloud saves with slot limits, wallet/coin economy, PayPal & Xendit top-ups, and rewarded ad crediting. Builder actions consume coins (save: 2, copy: 1, download: 1 by default) to keep template operations tied to the wallet.

### Tech Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui component primitives
- Prisma ORM with PostgreSQL
- NextAuth (credentials + email magic link)
- Zustand for builder state, Zod for validation
- Vitest + Testing Library for unit tests
- Playwright for smoke E2E

### Requirements
- Node.js ≥ 18
- PostgreSQL database

### Environment Variables
Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Email provider (`EMAIL_SERVER`, `EMAIL_FROM`) if enabling magic links
- Wallet economy: `REWARD_PER_AD`, `AD_COOLDOWN_MIN`, `COINS_PER_PACK`, `SLOTS_PER_PACK`, `USD_TO_COINS`, `IDR_TO_COINS`
- Builder feature costs: `NEXT_PUBLIC_BUILDER_SAVE_COST`, `NEXT_PUBLIC_BUILDER_COPY_COST`, `NEXT_PUBLIC_BUILDER_DOWNLOAD_COST`
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `WEBHOOK_SECRET_PAYPAL`
- Xendit: `XENDIT_SECRET_KEY`, `XENDIT_ENV`, `WEBHOOK_SECRET_XENDIT`

### Setup
```bash
npm install
npm run db:generate
npx prisma migrate dev
npm run dev
```

Visit `http://localhost:3000/builder` for the guest builder. Auth routes live under `/sign-in` and `/sign-up`.

### Testing
- **Unit**: `npm test` (Vitest + Testing Library)
- **Watch**: `npm run test:watch`
- **E2E smoke**: `npm run test:e2e` (requires app running locally; configure `PLAYWRIGHT_BASE_URL` if needed)

### Formatting & Linting
```bash
npm run lint
```

### Deployment (Vercel)
1. Create a Postgres database (Neon/Supabase).
2. Set environment variables in Vercel dashboard.
3. Add `npx prisma migrate deploy` to the build command or a separate Vercel hook.
4. Configure webhook secrets for PayPal/Xendit and point providers to the deployed URLs:
   - PayPal: `https://your-app.vercel.app/api/wallet/topup/paypal/webhook`
   - Xendit: `https://your-app.vercel.app/api/wallet/topup/xendit/webhook`

### Useful Scripts
- `npm run db:migrate` – run Prisma migrations locally
- `npm run test` / `npm run test:e2e` – run unit or Playwright suites
