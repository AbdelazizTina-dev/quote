# Quote

A tool for solo tradespeople to turn a job estimate into a professional, itemized
PDF quote, sent via a secure client link, with an option for the client to accept
and pay a deposit. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the full pitch.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + magic-link auth)
- Stripe Connect + Checkout (Phase 4)

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Run the migration: paste `supabase/migrations/00001_init.sql` into the
   Supabase SQL Editor and run it (or use `supabase db push` with the CLI).
3. Copy `.env.example` to `.env.local` and fill in your project URL and anon key
   (Supabase dashboard → Settings → API).
4. In Supabase dashboard → Authentication → URL Configuration, set the Site URL
   to `http://localhost:3000` (update when deploying).
5. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

Sign in with a magic link, then fill in your business profile under Settings.

> Note: `.npmrc` pins the public npm registry for this project (the machine's
> global npm config points at a corporate registry).

## Build phases (from the brief)

- [x] **Phase 1:** Auth + business profile + schema (users/profiles, quotes, line_items)
- [x] **Phase 2:** Quote builder UI + PDF generation
- [x] **Phase 2.5:** Sales tax + notes/terms on quotes (before the public page, so PDF and client view are built once)
- [x] **Phase 3:** Public client-facing quote page (`/q/{token}`)
- [x] **Phase 4:** Stripe Connect onboarding + deposit checkout
- [x] **Phase 5:** Dashboard polish (duplicate quote) + email sending
- [ ] **Phase 6:** Subscription billing, error handling, deploy

## Architecture notes

- Money is stored as **integer cents** everywhere (`unit_price_cents`, fixed
  deposits). Percent deposits store the whole-number percent.
- Every quote gets a non-guessable hex `token` at insert time (Postgres
  `gen_random_bytes`), which will back the public `/q/{token}` link in Phase 3.
- Row Level Security restricts profiles/quotes/line_items to their owner. The
  public quote page will read via a server-side service-role client, not RLS.
- A DB trigger auto-creates a `profiles` row on signup.
- Auth-session refresh and route protection live in `src/proxy.ts`
  (Next 16's replacement for `middleware.ts`).
- **Payments:** Stripe Connect **Standard** accounts with **direct charges** —
  deposits are charged on the tradesperson's own Stripe account (created via
  `connectStripe`, onboarded with Account Links). The platform never holds
  client money and takes no per-payment fee (monetization = flat subscription).
  Payment confirmation is dual-path: the Checkout success redirect verifies the
  session server-side (instant, works in dev), and `/api/stripe/webhook`
  (`checkout.session.completed`, with "listen to connected accounts" enabled)
  is the production-authoritative path. Both funnel through the idempotent
  `markQuotePaid`.
