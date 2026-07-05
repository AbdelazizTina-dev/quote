import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Quote } from "@/lib/types";
import { createQuote } from "@/app/quotes/actions";

const STATUS_STYLES: Record<Quote["status"], string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
};

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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {profile?.business_name || "Your quotes"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/settings/profile"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {needsProfile && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Finish setting up your{" "}
          <Link href="/settings/profile" className="font-medium underline">
            business profile
          </Link>{" "}
          — it appears on every quote you send.
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900">Quotes</h2>
          <form action={createQuote}>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              New quote
            </button>
          </form>
        </div>

        {quotes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
            No quotes yet. Create your first one with the button above.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {quote.client_name || "Untitled quote"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[quote.status]}`}
                  >
                    {quote.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
