-- Phase 1 schema: profiles (business profile), quotes, line_items
-- Money is stored as integer cents throughout.

create extension if not exists pgcrypto with schema extensions;

create type public.quote_status as enum ('draft', 'sent', 'viewed', 'accepted', 'paid');
create type public.deposit_type as enum ('fixed', 'percent');
create type public.line_item_kind as enum ('labor', 'material');

-- One row per tradesperson, keyed to their auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  contact_email text,
  phone text,
  logo_url text,
  stripe_account_id text,
  -- Default deposit terms applied to new quotes (percent 0-100, or cents when fixed).
  deposit_type public.deposit_type not null default 'percent',
  deposit_value integer not null default 25 check (deposit_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Non-guessable token for the public client link: /q/{token}
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  client_name text not null default '',
  client_email text,
  client_phone text,
  job_description text not null default '',
  status public.quote_status not null default 'draft',
  -- Deposit terms snapshotted from the profile at creation; editable per quote.
  deposit_type public.deposit_type not null default 'percent',
  deposit_value integer not null default 25 check (deposit_value >= 0),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_user_id_idx on public.quotes (user_id);
create index quotes_token_idx on public.quotes (token);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  kind public.line_item_kind not null default 'labor',
  description text not null default '',
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index line_items_quote_id_idx on public.line_items (quote_id);

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- Auto-create an empty profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, contact_email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: owners only. The public quote page (Phase 3) will read
-- via a server-side service-role client or a security-definer RPC, not these policies.
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.line_items enable row level security;

create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own quotes" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own line items" on public.line_items
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.user_id = auth.uid()
    )
  );
