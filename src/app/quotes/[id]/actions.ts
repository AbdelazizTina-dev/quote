"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DepositType, LineItemKind } from "@/lib/types";

export type QuotePayload = {
  client_name: string;
  client_email: string;
  client_phone: string;
  job_description: string;
  deposit_type: DepositType;
  deposit_value: number;
  tax_rate_bps: number;
  terms: string;
  items: {
    kind: LineItemKind;
    description: string;
    quantity: number;
    unit_price_cents: number;
  }[];
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveQuote(
  quoteId: string,
  payload: QuotePayload
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const depositValue = Math.max(0, Math.round(payload.deposit_value));

  const { error: quoteError } = await supabase
    .from("quotes")
    .update({
      client_name: payload.client_name.trim(),
      client_email: payload.client_email.trim() || null,
      client_phone: payload.client_phone.trim() || null,
      job_description: payload.job_description.trim(),
      deposit_type: payload.deposit_type,
      deposit_value:
        payload.deposit_type === "percent"
          ? Math.min(100, depositValue)
          : depositValue,
      tax_rate_bps: Math.min(10000, Math.max(0, Math.round(payload.tax_rate_bps))),
      terms: payload.terms.trim(),
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  if (quoteError) return { ok: false, error: quoteError.message };

  // Replace all line items in one shot — simplest correct sync at this scale.
  const { error: deleteError } = await supabase
    .from("line_items")
    .delete()
    .eq("quote_id", quoteId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const rows = payload.items
    .filter((item) => item.description.trim() || item.unit_price_cents > 0)
    .map((item, index) => ({
      quote_id: quoteId,
      kind: item.kind,
      description: item.description.trim(),
      quantity: Math.max(0, item.quantity),
      unit_price_cents: Math.max(0, Math.round(item.unit_price_cents)),
      position: index,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("line_items").insert(rows);
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteQuote(quoteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/quotes/${quoteId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
