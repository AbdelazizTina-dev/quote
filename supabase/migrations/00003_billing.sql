-- Phase 6b: subscription billing.
-- Trial is computed from profiles.created_at (30 days) — no Stripe object
-- exists until the user actually subscribes.

alter table public.profiles
  add column stripe_customer_id text,
  add column subscription_status text not null default 'none',
  add column subscription_period_end timestamptz;
