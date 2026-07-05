import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LineItem, Quote } from "@/lib/types";
import { QuoteEditor } from "./editor";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: quoteData }, { data: itemsData }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("quote_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!quoteData) notFound();

  return (
    <QuoteEditor
      quote={quoteData as Quote}
      initialItems={(itemsData ?? []) as LineItem[]}
    />
  );
}
