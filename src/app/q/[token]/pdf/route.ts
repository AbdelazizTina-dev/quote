import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import type { LineItem, Profile, Quote } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("token", token)
    .neq("status", "draft")
    .single();
  if (!quote) {
    return new NextResponse("Quote not found", { status: 404 });
  }

  const [{ data: items }, { data: profile }] = await Promise.all([
    admin
      .from("line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position", { ascending: true }),
    admin.from("profiles").select("*").eq("id", quote.user_id).single(),
  ]);
  if (!profile) {
    return new NextResponse("Quote not found", { status: 404 });
  }

  const pdf = await renderQuotePdf(
    quote as Quote,
    (items ?? []) as LineItem[],
    profile as Profile
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${(quote as Quote).id.slice(0, 8)}.pdf"`,
    },
  });
}
