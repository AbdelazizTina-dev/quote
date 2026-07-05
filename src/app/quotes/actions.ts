"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function createQuote() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // New quotes inherit the profile's default deposit, tax, and terms.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("deposit_type, deposit_value, default_tax_rate_bps, default_terms")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<
    Profile,
    "deposit_type" | "deposit_value" | "default_tax_rate_bps" | "default_terms"
  > | null;

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      deposit_type: profile?.deposit_type ?? "percent",
      deposit_value: profile?.deposit_value ?? 25,
      tax_rate_bps: profile?.default_tax_rate_bps ?? 0,
      terms: profile?.default_terms ?? "",
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard?error=${encodeURIComponent(error?.message ?? "Could not create quote")}`);
  }

  redirect(`/quotes/${data.id}`);
}
