import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import type { LineItem, Profile, Quote } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // RLS scopes these to the signed-in owner.
  const [{ data: quote }, { data: items }, { data: profile }] =
    await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).single(),
      supabase
        .from("line_items")
        .select("*")
        .eq("quote_id", id)
        .order("position", { ascending: true }),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ]);

  if (!quote || !profile) {
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
