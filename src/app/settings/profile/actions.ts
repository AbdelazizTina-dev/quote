"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { DepositType, Profile } from "@/lib/types";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const depositType = (formData.get("deposit_type") as DepositType) ?? "percent";
  const rawDeposit = Number(formData.get("deposit_value") ?? 0);
  // Percent is stored as-is (0-100); fixed amounts are entered in dollars, stored in cents.
  const depositValue =
    depositType === "fixed"
      ? Math.round(rawDeposit * 100)
      : Math.min(100, Math.max(0, Math.round(rawDeposit)));

  // Tax entered as a percent (8.25), stored in basis points (825).
  const taxRateBps = Math.min(
    10000,
    Math.max(0, Math.round(Number(formData.get("tax_rate") ?? 0) * 100))
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: String(formData.get("business_name") ?? "").trim(),
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      deposit_type: depositType,
      deposit_value: depositValue,
      default_tax_rate_bps: taxRateBps,
      default_terms: String(formData.get("default_terms") ?? "").trim(),
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings/profile");
  redirect("/settings/profile?saved=1");
}

// Starts (or resumes) Stripe Connect onboarding for a Standard account.
// Deposits are charged directly on the connected account, so client money
// never touches the platform.
export async function connectStripe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileData as Profile | null;
  if (!profile) redirect("/settings/profile?error=Profile not found");

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  let onboardingUrl: string;

  try {
    const stripe = getStripe();
    let accountId = profile.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: profile.contact_email ?? user.email,
        business_profile: profile.business_name
          ? { name: profile.business_name }
          : undefined,
      });
      accountId = account.id;
      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings/profile?stripe=refresh`,
      return_url: `${origin}/settings/profile?stripe=return`,
      type: "account_onboarding",
    });
    onboardingUrl = link.url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not connect to Stripe";
    redirect(`/settings/profile?error=${encodeURIComponent(message)}`);
  }

  redirect(onboardingUrl);
}
