export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "paid";
export type DepositType = "fixed" | "percent";
export type LineItemKind = "labor" | "material";

export type Profile = {
  id: string;
  business_name: string;
  contact_email: string | null;
  phone: string | null;
  logo_url: string | null;
  stripe_account_id: string | null;
  deposit_type: DepositType;
  deposit_value: number;
  default_tax_rate_bps: number;
  default_terms: string;
  stripe_customer_id: string | null;
  subscription_status: string;
  subscription_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type Quote = {
  id: string;
  user_id: string;
  token: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  job_description: string;
  status: QuoteStatus;
  deposit_type: DepositType;
  deposit_value: number;
  tax_rate_bps: number;
  terms: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LineItem = {
  id: string;
  quote_id: string;
  kind: LineItemKind;
  description: string;
  quantity: number;
  unit_price_cents: number;
  position: number;
  created_at: string;
};

export function quoteSubtotalCents(
  items: Pick<LineItem, "quantity" | "unit_price_cents">[]
): number {
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price_cents), 0);
}

export function taxCents(subtotalCents: number, taxRateBps: number): number {
  return Math.round((subtotalCents * taxRateBps) / 10000);
}

export function quoteTotals(
  items: Pick<LineItem, "quantity" | "unit_price_cents">[],
  taxRateBps: number
): { subtotalCents: number; taxCents: number; totalCents: number } {
  const subtotalCents = quoteSubtotalCents(items);
  const tax = taxCents(subtotalCents, taxRateBps);
  return { subtotalCents, taxCents: tax, totalCents: subtotalCents + tax };
}

export function formatTaxRate(taxRateBps: number): string {
  return `${(taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function depositCents(totalCents: number, type: DepositType, value: number): number {
  return type === "fixed" ? value : Math.round((totalCents * value) / 100);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
