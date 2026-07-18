import { createAdminClient } from "@/lib/supabase/admin";

// Accept + pay is a single action in v1, so both timestamps land together.
// The status guard makes this idempotent across the success-redirect path
// and the webhook both firing.
export async function markQuotePaid(quoteId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("quotes")
    .update({ status: "paid", accepted_at: now, paid_at: now })
    .eq("id", quoteId)
    .in("status", ["sent", "viewed", "accepted"]);
}
