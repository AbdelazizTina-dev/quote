import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  depositCents,
  formatCents,
  formatTaxRate,
  quoteTotals,
  type LineItem,
  type Profile,
  type Quote,
} from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function loadQuote(token: string) {
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("token", token)
    .neq("status", "draft") // drafts aren't public until "sent" via copy-link
    .single();
  if (!quote) return null;

  const [{ data: items }, { data: profile }] = await Promise.all([
    admin
      .from("line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position", { ascending: true }),
    admin.from("profiles").select("*").eq("id", quote.user_id).single(),
  ]);
  if (!profile) return null;

  // First open by the client: sent -> viewed.
  if (quote.status === "sent") {
    await admin
      .from("quotes")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", quote.id)
      .eq("status", "sent");
    quote.status = "viewed";
  }

  return {
    quote: quote as Quote,
    items: (items ?? []) as LineItem[],
    profile: profile as Profile,
  };
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadQuote(token);
  if (!data) notFound();

  const { quote, items, profile } = data;
  const { subtotalCents, taxCents, totalCents } = quoteTotals(
    items,
    quote.tax_rate_bps
  );
  const depositDue = depositCents(
    totalCents,
    quote.deposit_type,
    quote.deposit_value
  );
  const issuedDate = new Date(quote.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              {profile.business_name}
            </h1>
            <div className="mt-1 space-y-0.5 text-sm text-zinc-600">
              {profile.contact_email && <p>{profile.contact_email}</p>}
              {profile.phone && <p>{profile.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-900">
              Quote
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-600">
              #{quote.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-sm text-zinc-600">{issuedDate}</p>
          </div>
        </header>

        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Prepared for
          </h2>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {quote.client_name}
          </p>
        </div>

        {quote.job_description && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Job description
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-700">
              {quote.job_description}
            </p>
          </div>
        )}

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-900 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
              <th className="pb-2 pr-2 font-semibold">Description</th>
              <th className="pb-2 pr-2 text-right font-semibold">Qty</th>
              <th className="hidden pb-2 pr-2 text-right font-semibold sm:table-cell">
                Unit price
              </th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100">
                <td className="py-2.5 pr-2">
                  <span className="text-zinc-900">{item.description}</span>
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {item.kind}
                  </span>
                </td>
                <td className="py-2.5 pr-2 text-right tabular-nums text-zinc-700">
                  {item.quantity}
                </td>
                <td className="hidden py-2.5 pr-2 text-right tabular-nums text-zinc-700 sm:table-cell">
                  {formatCents(item.unit_price_cents)}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900">
                  {formatCents(Math.round(item.quantity * item.unit_price_cents))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 max-w-60 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCents(subtotalCents)}</span>
          </div>
          {quote.tax_rate_bps > 0 && (
            <div className="flex justify-between text-zinc-600">
              <span>Tax ({formatTaxRate(quote.tax_rate_bps)})</span>
              <span className="tabular-nums">{formatCents(taxCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-900 pt-2 text-base font-bold text-zinc-900">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(totalCents)}</span>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-blue-50 p-5 ring-1 ring-inset ring-blue-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-950">
                Deposit due to accept
              </p>
              <p className="mt-0.5 text-xs text-blue-900/70">
                {quote.deposit_type === "percent"
                  ? `${quote.deposit_value}% of total`
                  : "Fixed deposit"}{" "}
                — remainder due on completion
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-950">
              {formatCents(depositDue)}
            </p>
          </div>
          {/* Phase 4: "Accept & pay deposit" via Stripe Checkout renders here */}
          <p className="mt-3 text-xs text-blue-900/70">
            To accept this quote, contact {profile.business_name}
            {profile.phone ? ` at ${profile.phone}` : ""}
            {!profile.phone && profile.contact_email
              ? ` at ${profile.contact_email}`
              : ""}
            . Online acceptance and deposit payment are coming soon.
          </p>
        </div>

        {quote.terms && (
          <div className="mt-8 border-t border-zinc-100 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Notes &amp; terms
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-600">
              {quote.terms}
            </p>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <a
            href={`/q/${quote.token}/pdf`}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Download as PDF
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-400">
        Powered by Quote
      </p>
    </main>
  );
}
