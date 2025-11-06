# AI Context Manager Webapp — Implementation Plan (for GPT‑Code/agents)

> Deliver a minimal, pleasant, Notion‑ish builder that lets users compose structured AI context sections, copy them as a single formatted block, and optionally save templates to the cloud with a light coin/ads/payments system. Deploy to Vercel.

---

## 0) TL;DR
- **Stack**: Next.js 14 (App Router, TypeScript), Tailwind + shadcn/ui, Prisma + PostgreSQL (Neon or Supabase), NextAuth, Zod, Zustand, next-themes, Monaco (lazy) for attachment editing.
- **Core features**: Section picker, dynamic section editor, copy‑to‑clipboard (single formatted output), save/load templates (10 free slots per user), favorites, history, light/dark.
- **Economy**: Wallet with coins, +100 to +250 per rewarded ad (configurable). Buy extra **template slots** with coins; top‑up via PayPal and Xendit.
- **Deployment**: Vercel with Postgres (Neon/Supabase) and OAuth/email.

---

## 1) Goals & Non‑Goals
### Goals
1. Build a **context manager** to assemble AI prompts composed of structured sections.
2. Allow **guest usage** (no login) with full builder + copy, but **no cloud save**.
3. Authenticated users get **10 free template slots**. More slots require coins.
4. Integrate **favorites** so starred templates/saved presets float to the top.
5. Provide **history** of saved templates; open, duplicate, delete.
6. **Copy** renders one canonical formatted block with box‑drawing headers.
7. **Payments/coins**: rewarded ads for coins, PayPal and Xendit top‑ups.
8. **Polished UX** with light/dark theme.

### Non‑Goals (v1)
- Real‑time collaboration, multi‑cursor editing.
- Rich text with embeds; we will use simple textareas/Monaco.
- Fine‑grained ACL/sharing; v1 is personal.

---

## 2) Section Taxonomy
Each **Template Category** exposes a set of **Section Types**. Users can add any section in any order. Reordering is supported via drag‑and‑drop. Sections render to output using the rules in §7.

### Categories and Section Types
**Basic Template**
- `system_prompt`, `user_prompt`, `context`, `objectives`, `constraints`, `attachment`, `reference`, `examples`

**Creative Template**
- `creative_brief`, `inspiration`, `brand_guidelines`, `target_audience`, `mood_board`, `constraints`, `notes`

**Researchers Template**
- `research_question`, `methodology`, `data_set`, `literature_review`, `hypothesis`, `variables`, `limitations`

**Business/Professionals Template**
- `context`, `objectives`, `background_info`, `stakeholders`, `timeline`, `budget_constraints`, `deliverables`

**Students Template**
- `assignment_brief`, `reference_material`, `rubric`, `draft_work`, `feedback_received`, `constraints`, `notes`

**Programmer Template**
- `system_prompt`, `user_prompt`, `attachment`, `error_log`, `requirements`, `constraints`, `previous_output`

> Note: `attachment` accepts filename + content; other sections are plain text fields.

---

## 3) UX Overview
### Key Screens
1. **Builder** (home):
   - Left sidebar: category picker, searchable section library, favorites toggle, add section button.
   - Main canvas: list of current sections as cards with title, content editor, drag handle, delete.
   - Header: Copy, Save, Template Name, Theme toggle, Auth controls.
   - Footer: Add new section button.
2. **My Templates**: grid/list with search, star/unstar, open, duplicate, delete; counter of slots used (`n / limit`).
3. **Wallet**: balance, transactions, buttons: "Watch ad for coins", "Top‑up" (PayPal/Xendit), "Buy slots".
4. **Auth**: sign in/up (email + password or OAuth), guest banner.

### Editing Controls
- Text sections: textarea with auto‑resize, word‑wrap, char count.
- Attachment: filename input + Monaco editor (language inferred by extension).
- Reordering: dnd-kit.
- Autosave to **localStorage** draft for both guests and logged‑in users; cloud save on demand.

### Copy button behavior
- Builds output per §7, writes to clipboard, shows toast, and offers "Download .txt".

---

## 4) Data Model
Using Prisma with PostgreSQL.

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String?
  image           String?
  passwordHash    String?  // null for OAuth
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Quotas / economy
  slotLimit       Int      @default(10)
  wallet          Wallet?

  templates       Template[]
  favorites       Favorite[]
  transactions    Transaction[]
}

model Template {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])

  name        String
  isStarred   Boolean  @default(false)
  category    String   // e.g. "basic", "programmer"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sections    Section[]
}

model Section {
  id            String   @id @default(cuid())
  templateId    String
  template      Template @relation(fields: [templateId], references: [id])

  type          String   // enum as string for flexibility
  title         String   // display name; for attachments: "ATTACHMENT: <filename>"
  orderIndex    Int
  filename      String?  // only for attachments
  content       String   // text content
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  templateId String
  createdAt DateTime @default(now())

  @@unique([userId, templateId])
}

model Wallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  balance   Int      @default(0) // coins
  updatedAt DateTime @updatedAt
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "ad_reward" | "paypal_topup" | "xendit_topup" | "buy_slots" | "spend_slot" | "refund"
  amount    Int      // positive for credit, negative for debit
  meta      Json?
  createdAt DateTime @default(now())
}
```

> Slot policy: a user may **own** at most `slotLimit` templates. Buying slots increases `slotLimit` via a transaction + server update.

---

## 5) API & Server Actions
Next.js App Router with **Route Handlers** in `/app/api/*` and **Server Actions** for mutations from forms. All inputs validated with Zod.

### Auth
- NextAuth with Credentials + Email (and optional OAuth). Passwords with bcrypt. Session JWT.

### Endpoints (REST‑like)
- `POST /api/auth/register` — create account.
- `POST /api/templates` — create template (enforce slot limit).
- `GET /api/templates` — list current user templates, supports `?q=&favorited=1`.
- `GET /api/templates/:id` — fetch with sections.
- `PATCH /api/templates/:id` — update meta, star/unstar.
- `DELETE /api/templates/:id` — delete.
- `PUT /api/templates/:id/sections` — replace section list (for reorder). 
- `POST /api/templates/:id/sections` — add section.
- `PATCH /api/sections/:id` — update one section.
- `DELETE /api/sections/:id` — delete section.
- `POST /api/wallet/ads/claim` — server‑verified ad reward.
- `POST /api/wallet/topup/paypal/create` — create checkout session.
- `POST /api/wallet/topup/paypal/webhook` — webhook handler.
- `POST /api/wallet/topup/xendit/create` — create invoice (Basic Auth with secret key).
- `POST /api/wallet/topup/xendit/webhook` — webhook handler. Must be idempotent and accept retries.
- `POST /api/wallet/buy-slots` — spend coins to add to `slotLimit`.
- `GET /api/wallet` — balance + last transactions.

**Provider call policy**: handle `429` with exponential backoff + jitter; honor response headers for remaining quota; fail gracefully to UI.

---

## 6) Economy Rules
- **Default slot limit**: 10 per user.
- **Watch ad**: server‑side verified reward, e.g. `REWARD_PER_AD=150` coins. Throttle to once per N minutes per user.
- **Buy slot pack**: e.g. 1000 coins per +10 slots; configurable as `SLOTS_PER_PACK` and `COINS_PER_PACK`.
- **Top‑up**: PayPal (card/global) and Xendit (ID gateways). Webhooks credit coins.

Server enforces:
- No save when `count(templates) >= slotLimit`.
- Transactions are append‑only; wallet balance is derived defensively (or updated transactionally with balance field).

---

## 7) Output Formatting Rules (Copy)
### General block structure
For a **non‑attachment** section named `TITLE`:
```
╔═══ TITLE ═══╗
<content>
╚═══ END TITLE ═══╝
```

For an **attachment** with `filename`:
```
╔═══ ATTACHMENT: <filename> ═══╗
<file contents>
╚═══ END OF ATTACHMENT: <filename> ═══╝
```

### Ordering and spacing
- Respect current section order.
- Insert a blank line between blocks.
- Trim trailing spaces; preserve user line breaks.
- For empty sections, **skip** in output.

### Pseudocode
```ts
function buildOutput(sections: SectionDto[]): string {
  return sections
    .filter(s => s.content?.trim().length)
    .sort((a,b) => a.orderIndex - b.orderIndex)
    .map(s => {
      const isAttach = s.type === 'attachment' && s.filename
      const title = isAttach ? `ATTACHMENT: ${s.filename}` : s.title.toUpperCase()
      const start = `╔═══ ${title} ═══╗`
      const end = isAttach ? `╚═══ END OF ${title} ═══╝` : `╚═══ END ${s.title.toUpperCase()} ═══╝`
      return [start, s.content, end].join('\n')
    })
    .join('\n\n')
}
```

### Clipboard & Download
- Use `navigator.clipboard.writeText`. Fallback: hidden `<textarea>` + `document.execCommand('copy')`.
- Offer **Download .txt** via Blob.

---

## 8) Client Architecture
- **State**: Zustand store for builder state: `{ templateId, name, category, sections[], dirty }`.
- **Forms**: React Hook Form + Zod.
- **Theme**: `next-themes` with `class` strategy. Persist theme in `localStorage`.
- **Editor**: Simple textarea for most; Monaco for attachments (dynamic import). Language detection by extension map.
- **DND**: `@dnd-kit/core` for section reorder.
- **UI Kit**: shadcn/ui (Button, Card, Dialog, Dropdown, Tabs, Toggle, Tooltip, Toast, Input, Textarea, Switch, Badge, Separator, Accordion).

### Directory Layout
```
/app
  /(public)
  /(auth)/sign-in
  /(auth)/sign-up
  /(dashboard)/templates
  /(dashboard)/wallet
  /builder  // /builder?templateId=... or empty for new
  /api/*
/components
/lib
  /db.ts
  /auth.ts
  /validators
  /output.ts
  /ads.ts
  /payments/{paypal,xendit}.ts
/prisma/schema.prisma
```

---

## 9) UI Components (selected)
- `SectionLibrary`: list of section types by category with search + ⭐ favorite toggle.
- `SectionCard`: header with title, drag handle, delete; body editor.
- `AttachmentCard`: filename input + Monaco editor.
- `BuilderHeader`: template name, Copy, Save, Download, theme toggle.
- `TemplateList`: cards with star, open, duplicate, delete, updatedAt.
- `WalletPanel`: balance, actions, recent transactions.

---

## 10) Validation Schemas (Zod)
```ts
export const SectionTypeEnum = z.enum([
  'system_prompt','user_prompt','context','objectives','constraints','attachment','reference','examples',
  'creative_brief','inspiration','brand_guidelines','target_audience','mood_board','notes',
  'research_question','methodology','data_set','literature_review','hypothesis','variables','limitations',
  'background_info','stakeholders','timeline','budget_constraints','deliverables',
  'assignment_brief','reference_material','rubric','draft_work','feedback_received','previous_output','error_log','requirements'
])

export const SectionSchema = z.object({
  id: z.string().optional(),
  type: SectionTypeEnum,
  title: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  filename: z.string().optional(),
  content: z.string().default('')
})

export const TemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  sections: z.array(SectionSchema)
})
```

---

## 11) Ads Integration (Rewarded)
We expose a pluggable interface. In development, a **fake rewarded ad** simulates completion.

```ts
// /lib/ads.ts
export interface RewardedAdProvider {
  show(): Promise<{ completed: boolean; impressionId?: string }>
}
```

Flow:
1. Client calls `provider.show()`; when completed, POST to `/api/wallet/ads/claim` with `impressionId`.
2. Server validates cooldown and signature (if real network provides) then credits `REWARD_PER_AD` coins and logs `Transaction`.

Configure per provider later without code changes.

---

## 12) Payments (PayPal & Xendit)
- Two rails: **coins top‑up** and **slot purchase**. Coins can be acquired via PayPal or Xendit; slot purchases always debit coins.
- All provider calls are **server‑to‑server** only.

### 12.a) Xendit integration (latest)
**Auth:** Use Basic Auth with the **Secret API Key** as username and an empty password. Build header as:
```
Authorization: Basic base64("<XENDIT_SECRET_KEY>:")
Content-Type: application/json
```
Never expose the secret on the client. All requests over HTTPS only.

**Create invoice/top‑up flow**
1) Client calls `POST /api/wallet/topup/xendit/create` with `{ amount, currency }`.
2) Server creates an invoice via Xendit using Basic Auth and returns the `invoice_url` to the client.
3) Webhook handler credits coins when invoice paid/settled (idempotent).

**Rate limit & error handling**
- Respect Xendit RPM headers `Rate-Limit-Limit`, `Rate-Limit-Remaining`, `Rate-Limit-Reset`.
- On `429 RATE_LIMIT_EXCEEDED`, back off with exponential delays and retry with jitter. Do not hammer; log and surface a soft error to UI.
- Each caller IP may be capped by Xendit; keep calls from server only.

### 12.b) PayPal integration (summary)
- Create order on server; capture via webhook; credit coins on `COMPLETED`. Keep idempotent store by `provider_order_id`.

### 12.c) Idempotency & accounting
- Every credit/debit is a `Transaction` row. Wallet balance is derived or updated in a single DB tx.
- All webhook mutations are **idempotent** using provider event IDs and a unique constraint.

### 12.d) Coins mapping (configurable)
- Example: `1 USD = 1000 coins`. For Xendit in IDR: `10000 IDR = 1000 coins`. Store rates in env and show on Wallet UI.

## 12.1) Xendit Webhook Behavior (delivery & retries)
- Webhooks are HTTP POSTs to our configured endpoint. Treat any 2XX as success, anything else as failure.
- Xendit will automatically retry up to **6** times with exponential backoff after the original attempt: 15m, then +45m (≈1h total), +2h (≈3h), +3h (≈6h), +6h (≈12h), +12h (≈24h). We must keep the handler **idempotent** and **fast**.
- Provide a small queue or job wrapper if our DB is down, but always return 2XX after we enqueue safely.
- Support **manual resend** of specific events from the dashboard; our handler must handle replay without double‑crediting.

---

## 13) Access Control & Policies
- **Guest**: no server writes for templates; only localStorage drafts. Server still allows ad viewing only when logged in to avoid abuse.
- **User**: can CRUD own templates; cannot exceed slotLimit.
- **Rate limits**: simple IP + user throttling for wallet endpoints (e.g. 5/minute) using edge runtime or Redis if available.

---

## 14) Testing Strategy
- **Unit**: output builder (edge cases), validators, utility functions.
- **Integration**: API routes with supertest (via next-test-api-route-handler or app route request). Prisma test db.
- **E2E**: Playwright: create account, add sections, copy, save, star, buy slots (mock payments), dark mode toggle.

---

## 15) Security & Privacy
- Hash passwords with bcrypt, `12` rounds.
- CSRF-safe via SameSite Lax and server actions; use NextAuth anti‑CSRF.
- Parameterized SQL via Prisma. Zod input validation everywhere.
- **Xendit**: use HTTPS only; server uses Basic Auth with `XENDIT_SECRET_KEY`. Do not log raw keys. Redact keys in error logs.
- Verify webhooks (signature or shared secret when available). Handlers are idempotent and side-effect safe on retries.
- Do not store ad network PII; only impression IDs.
- Size limits: per section 512 KB, per attachment 2 MB (configurable). Server rejects oversize bodies.
---

## 16) i18n
- Default language: **ID** with room for EN later. Keep all labels in a `locales` file.

---

## 17) Analytics & Logging (optional)
- Minimal event logger: copy_clicked, save_success, ad_reward, topup_success, buy_slots_success.

---

## 18) Deployment (Vercel)
1. Create project; set Node 18+.
2. Provision **Postgres** (Neon/Supabase) and set env vars.
3. `prisma migrate deploy` in build step.
4. `NEXTAUTH_URL`, `NEXTAUTH_SECRET` set. Provider keys for PayPal/Xendit.
5. Edge runtime only for lightweight endpoints; DB routes remain serverless function runtime.

**Env Vars**
```
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
EMAIL_SERVER=... (optional)
EMAIL_FROM=...
REWARD_PER_AD=150
AD_COOLDOWN_MIN=5
COINS_PER_PACK=1000
SLOTS_PER_PACK=10
USD_TO_COINS=1000
IDR_TO_COINS=0.1  # example: 10000 IDR -> 1000 coins
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
XENDIT_SECRET_KEY=...   # used for Basic Auth, never exposed client-side
XENDIT_PUBLIC_KEY=...   # optional for client widgets; not required for server calls
XENDIT_ENV=live|test
WEBHOOK_SECRET_PAYPAL=...
WEBHOOK_SECRET_XENDIT=...  # if using a shared secret/signature verification
```
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
EMAIL_SERVER=... (optional)
EMAIL_FROM=...
REWARD_PER_AD=150
AD_COOLDOWN_MIN=5
COINS_PER_PACK=1000
SLOTS_PER_PACK=10
USD_TO_COINS=1000
IDR_TO_COINS=0.1  # example: 10000 IDR -> 1000 coins
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
XENDIT_API_KEY=...
WEBHOOK_SECRET_PAYPAL=...
WEBHOOK_SECRET_XENDIT=...
```

---

## 19) Implementation Tasks
### Phase A — Project setup
- Next.js 14 TS, Tailwind, shadcn, Prisma, NextAuth, Zod, Zustand, next-themes.
- Add `prisma/schema.prisma`; run `prisma migrate dev`.

### Phase B — Builder MVP
- Section library with categories; add section flow.
- Section cards (textarea); attachment card (filename + Monaco).
- Reorder via dnd-kit; delete; autosave to localStorage.
- Copy and Download .txt using §7.

### Phase C — Auth + Templates CRUD
- NextAuth email/password.
- Save template; enforce slot limit; My Templates page with star and search.

### Phase D — Wallet & Economy
- Wallet balance + transactions.
- Rewarded ad stub + server claim endpoint with cooldown.
- Buy slots with coins; increase `slotLimit`.

### Phase E — Payments
- PayPal & Xendit create + webhooks; credit coins on success.

### Phase F — Polish
- Dark/light, responsive, toasts, empty states.
- Tests: unit + e2e.
- Deploy to Vercel.

---

## 20) Acceptance Criteria (v1)
- Guest can open builder, add any sections, copy output matching spec exactly.
- Logged‑in user can save up to 10 templates; 11th shows purchase flow.
- Wallet shows balance; ad reward increases coins within cooldown.
- Buying slots with coins increases slot limit and allows saving more templates.
- Favorite templates appear at the top for that user.
- Dark/light mode toggles and persists.
- Deleting a template decreases used slot count.

---

## 21) Output Unit Tests (examples)
```ts
it('builds non-attachment blocks with END markers', () => {
  const out = buildOutput([
    { type:'system_prompt', title:'SYSTEM PROMPT', orderIndex:0, content:'You are...', filename: undefined }
  ])
  expect(out).toContain('╔═══ SYSTEM PROMPT ═══╗')
  expect(out).toContain('╚═══ END SYSTEM PROMPT ═══╝')
})

it('builds attachment blocks with filename markers', () => {
  const out = buildOutput([
    { type:'attachment', title:'ATTACHMENT: main.py', orderIndex:0, filename:'main.py', content:'print("hi")' }
  ])
  expect(out).toContain('╔═══ ATTACHMENT: main.py ═══╗')
  expect(out).toContain('╚═══ END OF ATTACHMENT: main.py ═══╝')
})
```

---

## 22) Styling Notes
- Keep a Notion‑like card layout: generous spacing, neutral grays, rounded‑2xl.
- `font-mono` for attachment editors; `font-sans` elsewhere.
- Display section type badge on card header.

---

## 23) Open Questions / Configurable
- Exact coin rewards and pricing tiers.
- Which OAuth providers to enable first.
- Whether to allow exporting/importing a template as JSON.

---

## 24) Appendix — Minimal Code Skeleton
```tsx
// /lib/output.ts
export type SectionDto = { type:string; title:string; orderIndex:number; filename?:string; content:string }
export const buildOutput = (sections: SectionDto[]) => {
  return sections
    .filter(s => s.content?.trim().length)
    .sort((a,b)=>a.orderIndex-b.orderIndex)
    .map(s => {
      const isAtt = s.type === 'attachment' && s.filename
      const title = isAtt ? `ATTACHMENT: ${s.filename}` : s.title.toUpperCase()
      const start = `╔═══ ${title} ═══╗`
      const end = isAtt ? `╚═══ END OF ${title} ═══╝` : `╚═══ END ${s.title.toUpperCase()} ═══╝`
      return `${start}\n${s.content}\n${end}`
    })
    .join('\n\n')
}

// /app/builder/actions.ts
'use server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { TemplateSchema } from '@/lib/validators'

export async function saveTemplate(input: unknown) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const data = TemplateSchema.parse(input)

  const count = await db.template.count({ where:{ ownerId: session.user.id } })
  const me = await db.user.findUnique({ where:{ id: session.user.id } })
  if (count >= (me?.slotLimit ?? 10)) throw new Error('Slot limit reached')

  const created = await db.template.create({
    data: {
      ownerId: session.user.id,
      name: data.name,
      category: data.category,
      sections: { create: data.sections.map((s,i)=>({
        type: s.type, title: s.title, orderIndex: s.orderIndex, filename: s.filename, content: s.content
      })) }
    }, include:{ sections:true }
  })
  return created
}
```

---

This plan is intentionally explicit so an agent can scaffold the repo, wire the DB, and ship a usable v1 on Vercel.

