import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { markQuotePaid } from "@/lib/payments";

// Production path for payment confirmation. Configure the endpoint in the
// Stripe dashboard with "Listen to events on Connected accounts" and the
// checkout.session.completed event. Local dev works without it (the success
// redirect verifies the session), or use `stripe listen --forward-to`.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const quoteId = session.metadata?.quote_id;
    if (session.payment_status === "paid" && quoteId) {
      await markQuotePaid(quoteId);
    }
  }

  return NextResponse.json({ received: true });
}
