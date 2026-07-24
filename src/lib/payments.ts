import { after } from "next/server";
import { notifyOwner } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// Accept + pay is a single action in v1, so both timestamps land together.
// The status guard makes this idempotent across the success-redirect path
// and the webhook both firing — only the call that actually flips the row
// sends the notification.
export async function markQuotePaid(quoteId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("quotes")
    .update({ status: "paid", accepted_at: now, paid_at: now })
    .eq("id", quoteId)
    .in("status", ["sent", "viewed", "accepted"])
    .select("id");

  if (data && data.length > 0) {
    after(() => notifyOwner(quoteId, "paid"));
  }
}
