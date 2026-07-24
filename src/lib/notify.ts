import { appUrl, notificationEmail, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  depositCents,
  formatCents,
  quoteTotals,
  type LineItem,
  type Quote,
} from "@/lib/types";

// Best-effort tradesperson notification — never throws, no-ops when email
// isn't configured.
export async function notifyOwner(
  quoteId: string,
  event: "viewed" | "paid"
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: quoteData } = await admin
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();
    if (!quoteData) return;
    const quote = quoteData as Quote;

    const { data: profile } = await admin
      .from("profiles")
      .select("contact_email")
      .eq("id", quote.user_id)
      .single();
    let to = profile?.contact_email as string | null;
    if (!to) {
      const { data } = await admin.auth.admin.getUserById(quote.user_id);
      to = data.user?.email ?? null;
    }
    if (!to) return;

    let depositFormatted: string | undefined;
    if (event === "paid") {
      const { data: items } = await admin
        .from("line_items")
        .select("quantity, unit_price_cents")
        .eq("quote_id", quoteId);
      const { totalCents } = quoteTotals(
        (items ?? []) as LineItem[],
        quote.tax_rate_bps
      );
      depositFormatted = formatCents(
        depositCents(totalCents, quote.deposit_type, quote.deposit_value)
      );
    }

    const email = notificationEmail({
      event,
      clientName: quote.client_name,
      quoteRef: `#${quote.id.slice(0, 8).toUpperCase()}`,
      depositFormatted,
      link: `${appUrl()}/quotes/${quote.id}`,
    });
    await sendEmail({ to, ...email });
  } catch {
    // Notifications must never break the payment or page flow.
  }
}
