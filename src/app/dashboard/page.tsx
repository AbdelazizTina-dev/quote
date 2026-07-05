import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Quote } from "@/lib/types";
import { createQuote } from "@/app/quotes/actions";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { btnPrimary, card } from "@/lib/ui";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileData }, { data: quotesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);
  const profile = profileData as Profile | null;
  const quotes = (quotesData ?? []) as Quote[];

  const needsProfile = !profile?.business_name;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {profile?.business_name || "Your quotes"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {quotes.length === 0
                ? "Create a quote and send it to your client in minutes."
                : `${quotes.length} quote${quotes.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <form action={createQuote}>
            <button type="submit" className={btnPrimary}>
              + New quote
            </button>
          </form>
        </div>

        {needsProfile && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <span aria-hidden className="mt-0.5">⚠️</span>
            <p>
              Finish setting up your{" "}
              <Link
                href="/settings/profile"
                className="font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-800"
              >
                business profile
              </Link>{" "}
              — your business name and contact info appear on every quote you
              send.
            </p>
          </div>
        )}

        <section className="mt-8">
          {quotes.length === 0 ? (
            <div className={`${card} border-dashed p-12 text-center`}>
              <p className="text-4xl" aria-hidden>
                🧾
              </p>
              <h2 className="mt-3 text-base font-semibold text-zinc-900">
                No quotes yet
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">
                Hit “New quote” to build your first itemized quote — you can
                preview the PDF before anything is sent.
              </p>
            </div>
          ) : (
            <ul className={`${card} divide-y divide-zinc-100 overflow-hidden`}>
              {quotes.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {quote.client_name || "Untitled quote"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {quote.job_description || "No description"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="hidden text-xs text-zinc-500 sm:inline">
                        {new Date(quote.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <StatusBadge status={quote.status} />
                      <span aria-hidden className="text-zinc-300">
                        ›
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
