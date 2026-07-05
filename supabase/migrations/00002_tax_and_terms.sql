-- Phase 2.5: flat sales tax + notes/terms on quotes.
-- Tax rate is stored in basis points (825 = 8.25%) for integer math.

alter table public.profiles
  add column default_tax_rate_bps integer not null default 0
    check (default_tax_rate_bps between 0 and 10000),
  add column default_terms text not null default '';

alter table public.quotes
  add column tax_rate_bps integer not null default 0
    check (tax_rate_bps between 0 and 10000),
  add column terms text not null default '';
