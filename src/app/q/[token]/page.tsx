import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markQuotePaid } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";
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

// Fast path for dev and instant UX: verify the Checkout session on the
// success redirect. The webhook covers the case where the client closes
// the tab before returning.
async function verifyPayment(
  quote: Quote,
  profile: Profile,
  sessionId: string
): Promise<boolean> {
  if (!profile.stripe_account_id) return false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: profile.stripe_account_id }
    );
    if (
      session.payment_status === "paid" &&
      session.metadata?.quote_id === quote.id
    ) {
      await markQuotePaid(quote.id);
      return true;
    }
  } catch {
    // Bad/foreign session id — ignore; the webhook remains authoritative.
  }
  return false;
}

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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string; error?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId, error } = await searchParams;
  const data = await loadQuote(token);
  if (!data) notFound();

  const { quote, items, profile } = data;

  let justPaid = false;
  if (sessionId && quote.status !== "paid") {
    justPaid = await verifyPayment(quote, profile, sessionId);
    if (justPaid) quote.status = "paid";
  }
  const isPaid = quote.status === "paid";
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

  const payable =
    !isPaid && !!profile.stripe_account_id && depositDue >= 50;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {justPaid && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-base font-semibold text-green-800">
            ✓ Deposit received — thank you!
          </p>
          <p className="mt-1 text-sm text-green-700">
            {profile.business_name} has been notified and will be in touch to
            schedule the work.
          </p>
        </div>
      )}
      {error && !isPaid && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-800">
          {error === "checkout-failed"
            ? "Something went wrong starting the payment. Please try again."
            : "Online payment isn't available for this quote right now."}
        </div>
      )}
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

        {isPaid ? (
          <div className="mt-8 rounded-xl bg-green-50 p-5 ring-1 ring-inset ring-green-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-900">
                  ✓ Quote accepted — deposit paid
                </p>
                <p className="mt-0.5 text-xs text-green-800/80">
                  {quote.paid_at
                    ? `Paid ${new Date(quote.paid_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "Payment received"}{" "}
                  — remainder due on completion
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-green-900">
                {formatCents(depositDue)}
              </p>
            </div>
          </div>
        ) : (
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
            {payable ? (
              <form method="POST" action={`/q/${quote.token}/checkout`} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Accept &amp; pay {formatCents(depositDue)} deposit
                </button>
                <p className="mt-2 text-center text-xs text-blue-900/70">
                  Secure payment via Stripe. Paid directly to{" "}
                  {profile.business_name}.
                </p>
              </form>
            ) : (
              <p className="mt-3 text-xs text-blue-900/70">
                To accept this quote, contact {profile.business_name}
                {profile.phone ? ` at ${profile.phone}` : ""}
                {!profile.phone && profile.contact_email
                  ? ` at ${profile.contact_email}`
                  : ""}
                .
              </p>
            )}
          </div>
        )}

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
