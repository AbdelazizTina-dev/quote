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

  // New quotes inherit the profile's default deposit terms.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("deposit_type, deposit_value")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<Profile, "deposit_type" | "deposit_value"> | null;

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      deposit_type: profile?.deposit_type ?? "percent",
      deposit_value: profile?.deposit_value ?? 25,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard?error=${encodeURIComponent(error?.message ?? "Could not create quote")}`);
  }

  redirect(`/quotes/${data.id}`);
}
