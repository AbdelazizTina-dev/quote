"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accessInfo, LOCKED_MESSAGE } from "@/lib/billing";
import { appUrl, quoteEmail, sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import {
  depositCents,
  formatCents,
  quoteTotals,
  type DepositType,
  type LineItem,
  type LineItemKind,
  type Profile,
  type Quote,
} from "@/lib/types";

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

// Emails the quote link to the client and marks a draft as sent.
export async function sendQuote(quoteId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: quoteData }, { data: profileData }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  const quote = quoteData as Quote | null;
  const profile = profileData as Profile | null;
  if (!quote || !profile) return { ok: false, error: "Quote not found" };
  if (!accessInfo(profile).active) {
    return { ok: false, error: LOCKED_MESSAGE };
  }
  if (!quote.client_email) {
    return { ok: false, error: "Add the client's email address first." };
  }

  const { data: itemsData } = await supabase
    .from("line_items")
    .select("quantity, unit_price_cents")
    .eq("quote_id", quoteId);
  const { totalCents } = quoteTotals(
    (itemsData ?? []) as LineItem[],
    quote.tax_rate_bps
  );

  const email = quoteEmail({
    businessName: profile.business_name || "Your contractor",
    clientName: quote.client_name,
    totalFormatted: formatCents(totalCents),
    depositFormatted: formatCents(
      depositCents(totalCents, quote.deposit_type, quote.deposit_value)
    ),
    link: `${appUrl()}/q/${quote.token}`,
  });

  const sent = await sendEmail({ to: quote.client_email, ...email });
  if (!sent.ok) return sent;

  if (quote.status === "draft") {
    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("user_id", user.id)
      .eq("status", "draft");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/dashboard");
  }
  return { ok: true };
}

// Most solo trades quote the same handful of jobs repeatedly — duplicate
// copies everything except status/timestamps and gets a fresh token.
export async function duplicateQuote(quoteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: quoteData }, { data: itemsData }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("position", { ascending: true }),
  ]);
  const source = quoteData as Quote | null;
  if (!source) redirect("/dashboard");

  const { data: created, error } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      client_name: source.client_name,
      client_email: source.client_email,
      client_phone: source.client_phone,
      job_description: source.job_description,
      deposit_type: source.deposit_type,
      deposit_value: source.deposit_value,
      tax_rate_bps: source.tax_rate_bps,
      terms: source.terms,
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/quotes/${quoteId}?error=${encodeURIComponent(error?.message ?? "Could not duplicate")}`
    );
  }

  const items = (itemsData ?? []) as LineItem[];
  if (items.length > 0) {
    await supabase.from("line_items").insert(
      items.map((item, index) => ({
        quote_id: created.id,
        kind: item.kind,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        position: index,
      }))
    );
  }

  revalidatePath("/dashboard");
  redirect(`/quotes/${created.id}`);
}

// Copying the client link "sends" a draft: the public page only serves
// quotes that have left draft status.
export async function markSent(quoteId: string): Promise<SaveResult> {
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
  if (profileData && !accessInfo(profileData as Profile).active) {
    return { ok: false, error: LOCKED_MESSAGE };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

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
