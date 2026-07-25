"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PRICE_CENTS } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/settings/billing?error=Profile not found");
  return { supabase, user, profile: data as Profile };
}

async function ensureCustomer(): Promise<{ customerId: string }> {
  const { supabase, user, profile } = await requireProfile();
  if (profile.stripe_customer_id) {
    return { customerId: profile.stripe_customer_id };
  }
  const customer = await getStripe().customers.create({
    email: profile.contact_email ?? user.email,
    name: profile.business_name || undefined,
    metadata: { user_id: user.id },
  });
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id);
  return { customerId: customer.id };
}

export async function startSubscription() {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  let url: string;
  try {
    const { customerId } = await ensureCustomer();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Quote — monthly subscription",
              description: "Unlimited quotes, client links, and deposit collection",
            },
            unit_amount: PRICE_CENTS,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/billing`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    url = session.url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checkout";
    redirect(`/settings/billing?error=${encodeURIComponent(message)}`);
  }
  redirect(url);
}

export async function openBillingPortal() {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  let url: string;
  try {
    const { customerId } = await ensureCustomer();
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings/billing`,
    });
    url = session.url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not open billing portal";
    redirect(`/settings/billing?error=${encodeURIComponent(message)}`);
  }
  redirect(url);
}
