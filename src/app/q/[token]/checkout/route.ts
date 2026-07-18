import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { depositCents, quoteTotals, type LineItem, type Profile, type Quote } from "@/lib/types";

const MIN_CHARGE_CENTS = 50; // Stripe's minimum

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const backToQuote = (query = "") =>
    NextResponse.redirect(new URL(`/q/${token}${query}`, request.url), 303);

  const admin = createAdminClient();
  const { data: quoteData } = await admin
    .from("quotes")
    .select("*")
    .eq("token", token)
    .neq("status", "draft")
    .single();
  if (!quoteData) {
    return new NextResponse("Quote not found", { status: 404 });
  }
  const quote = quoteData as Quote;

  if (quote.status === "paid") return backToQuote();

  const [{ data: itemsData }, { data: profileData }] = await Promise.all([
    admin.from("line_items").select("*").eq("quote_id", quote.id),
    admin.from("profiles").select("*").eq("id", quote.user_id).single(),
  ]);
  const profile = profileData as Profile | null;
  if (!profile?.stripe_account_id) {
    return backToQuote("?error=online-payment-unavailable");
  }

  // Amounts are computed server-side from the stored quote — never trusted
  // from the client.
  const { totalCents } = quoteTotals(
    (itemsData ?? []) as LineItem[],
    quote.tax_rate_bps
  );
  const deposit = depositCents(totalCents, quote.deposit_type, quote.deposit_value);
  if (deposit < MIN_CHARGE_CENTS) {
    return backToQuote("?error=online-payment-unavailable");
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Deposit — quote #${quote.id.slice(0, 8).toUpperCase()}`,
                description: profile.business_name || undefined,
              },
              unit_amount: deposit,
            },
            quantity: 1,
          },
        ],
        customer_email: quote.client_email ?? undefined,
        metadata: { quote_id: quote.id },
        success_url: `${origin}/q/${token}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/q/${token}`,
      },
      { stripeAccount: profile.stripe_account_id }
    );

    if (!session.url) return backToQuote("?error=checkout-failed");
    return NextResponse.redirect(session.url, 303);
  } catch {
    return backToQuote("?error=checkout-failed");
  }
}
