## One-line pitch

A tool for solo plumbers/electricians/handymen to turn a job estimate into a professional, itemized PDF quote, sent via a secure client-specific link, with an option for the client to accept and pay a deposit on the spot.

## Who it's for

Solo or 2-person trade businesses (plumbing, electrical, handyman, cleaning, HVAC) currently quoting jobs via text message or a generic Word/Google Doc template. Not aimed at multi-crew operations — deliberately smaller in scope than Jobber/ServiceTitan.

## Explicit non-goals (keep scope tight for MVP)

- No scheduling/dispatch
- No payroll
- No inventory management
- No CRM/pipeline features
- No mobile app (responsive web is enough for v1)

Resist adding these even if it seems easy — the whole pitch is "does one thing well, costs less."

## Core user flow (MVP)

1. Tradesperson signs up, sets up their business profile (name, logo, contact info, Stripe Connect account).
2. Tradesperson creates a new quote: adds line items (labor hours x rate, materials x cost), a job description, and the client's name/email/phone.
3. System generates a branded, itemized PDF quote and a unique, non-guessable client link (e.g. `/q/{random-token}`).
4. Tradesperson sends the link to the client (via the app's "send" button, which emails/texts it — or just copies the link to send manually themselves in v1).
5. Client opens the link (no login required), sees the itemized quote, and can click "Accept & Pay Deposit."
6. Client pays a deposit (fixed amount or % of total, set by the tradesperson) via Stripe Checkout.
7. Tradesperson gets notified the quote was accepted and paid.
8. Tradesperson can see a dashboard of all quotes: draft / sent / viewed / accepted / paid.

## Suggested tech stack (optimize for solo-dev speed, not scale)

- **Framework:** Next.js (App Router) — one codebase for frontend + API routes
- **Database:** Postgres via a managed free/cheap tier (Supabase or Neon)
- **Auth:** Simple email/password or magic link (Supabase Auth, or NextAuth)
- **PDF generation:** `@react-pdf/renderer` or Puppeteer for HTML-to-PDF
- **Payments:** Stripe Checkout + Stripe Connect (so money goes to the tradesperson's own Stripe account, you just take a platform fee or flat subscription — do NOT hold client money yourself, avoids money-transmitter regulatory issues)
- **Email/SMS for sending links:** Postmark (email) to start; add Twilio SMS later if there's demand
- **Hosting:** Vercel (generous free tier) + Supabase/Neon free tier — should run under $20-30/month even with paying customers early on

## Monetization

Flat $19-39/month subscription per tradesperson (Stripe Billing). No usage-based pricing — keep billing as simple as the product.

## Build order (for a 2-week MVP)

1. **Day 1-2:** Auth + business profile setup + Postgres schema (users, quotes, line_items)
2. **Day 3-5:** Quote builder UI (add/edit line items, live total calculation) + PDF generation
3. **Day 6-7:** Public quote view page (the client-facing link) — no auth, clean/professional design
4. **Day 8-9:** Stripe Connect onboarding for tradespeople + Stripe Checkout for deposit collection on the public quote page
5. **Day 10-11:** Dashboard (list of quotes + status) + basic email sending of the quote link
6. **Day 12-14:** Polish, error handling, subscription billing (Stripe Billing for the $19-39/mo), deploy, test end-to-end with a real Stripe test account

## Validation before/while building

- Post about it in r/Plumbing, r/Electricians, r/HVAC, r/Handyman — this exact pain point (slow/unprofessional quotes, PII mistakes with the wrong client) already shows up in these communities.
- Get 5-10 tradespeople to agree to try it free for their first month before writing production-polish code — validate the core loop (create quote → client pays deposit) works for a real job before investing in the dashboard/polish.

## Competitive note

Jobber starts around $29-99+/month but bundles in scheduling, dispatch, and payroll most solo operators don't need yet. This product's pitch is explicitly "just the quote and deposit, none of the bloat" — keep that positioning in all copy/marketing.
