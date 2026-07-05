"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DepositType } from "@/lib/types";

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
