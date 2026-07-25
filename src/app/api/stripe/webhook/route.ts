import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { markQuotePaid } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

// Two Stripe endpoints point here, each with its own signing secret:
// - STRIPE_WEBHOOK_SECRET: connected-account events (deposit checkouts)
// - STRIPE_WEBHOOK_SECRET_PLATFORM: platform events (subscriptions)
// Local dev works without either (success redirects verify sessions).
function verify(body: string, signature: string): Stripe.Event | null {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_PLATFORM,
  ].filter((s): s is string => Boolean(s));
  for (const secret of secrets) {
    try {
      return getStripe().webhooks.constructEvent(body, signature, secret);
    } catch {
      // try the next secret
    }
  }
  return null;
}

async function syncSubscriptionByCustomer(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = sub.items.data[0]?.current_period_end;
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      subscription_status: sub.status,
      subscription_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("stripe_customer_id", customerId);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const body = await request.text();
  const event = verify(body, signature);
  if (!event) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const quoteId = session.metadata?.quote_id;
      if (session.payment_status === "paid" && quoteId) {
        await markQuotePaid(quoteId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionByCustomer(event.data.object);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
