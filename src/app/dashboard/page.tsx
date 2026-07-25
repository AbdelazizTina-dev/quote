import Link from "next/link";
import { redirect } from "next/navigation";
import { accessInfo } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import {
  depositCents,
  formatCents,
  quoteTotals,
  type LineItem,
  type Profile,
  type Quote,
  type QuoteStatus,
} from "@/lib/types";
import { createQuote } from "@/app/quotes/actions";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { card } from "@/lib/ui";

type QuoteRow = Quote & {
  line_items: Pick<LineItem, "quantity" | "unit_price_cents">[];
};

const FILTERS: { key: string; label: string; statuses: QuoteStatus[] }[] = [
  { key: "all", label: "All", statuses: ["draft", "sent", "viewed", "accepted", "paid"] },
  { key: "draft", label: "Drafts", statuses: ["draft"] },
  { key: "open", label: "Awaiting reply", statuses: ["sent", "viewed"] },
  { key: "paid", label: "Accepted & paid", statuses: ["accepted", "paid"] },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileData }, { data: quotesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("quotes")
      .select("*, line_items(quantity, unit_price_cents)")
      .order("created_at", { ascending: false }),
  ]);
  const profile = profileData as Profile | null;
  const quotes = (quotesData ?? []) as QuoteRow[];

  const withTotals = quotes.map((quote) => {
    const { totalCents } = quoteTotals(quote.line_items, quote.tax_rate_bps);
    return { quote, totalCents };
  });

  const openValue = withTotals
    .filter(({ quote }) => quote.status === "sent" || quote.status === "viewed")
    .reduce((sum, { totalCents }) => sum + totalCents, 0);
  const wonValue = withTotals
    .filter(({ quote }) => quote.status === "accepted" || quote.status === "paid")
    .reduce((sum, { totalCents }) => sum + totalCents, 0);
  const depositsCollected = withTotals
    .filter(({ quote }) => quote.status === "paid")
    .reduce(
      (sum, { quote, totalCents }) =>
        sum + depositCents(totalCents, quote.deposit_type, quote.deposit_value),
      0
    );

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = withTotals.filter(({ quote }) =>
    activeFilter.statuses.includes(quote.status)
  );

  const needsProfile = !profile?.business_name;
  const access = profile ? accessInfo(profile) : null;

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
            <SubmitButton pendingLabel="Creating…">+ New quote</SubmitButton>
          </form>
        </div>

        {access && !access.active && (
          <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
            Your free trial has ended — existing quotes and client links still
            work, but creating and sending is paused.{" "}
            <Link
              href="/settings/billing"
              className="font-semibold underline underline-offset-2"
            >
              Subscribe to continue
            </Link>
            .
          </div>
        )}
        {access && access.active && !access.subscribed && access.trialDaysLeft <= 7 && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            {access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"}{" "}
            left in your free trial.{" "}
            <Link
              href="/settings/billing"
              className="font-semibold underline underline-offset-2"
            >
              Subscribe
            </Link>{" "}
            to keep quoting without interruption.
          </div>
        )}
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

        {quotes.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={`${card} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Awaiting reply
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatCents(openValue)}
              </p>
            </div>
            <div className={`${card} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Work won
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatCents(wonValue)}
              </p>
            </div>
            <div className={`${card} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Deposits collected
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-green-700">
                {formatCents(depositsCollected)}
              </p>
            </div>
          </div>
        )}

        <section className="mt-8">
          {quotes.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/dashboard" : `/dashboard?filter=${f.key}`}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    activeFilter.key === f.key
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          )}

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
          ) : visible.length === 0 ? (
            <div className={`${card} border-dashed p-10 text-center text-sm text-zinc-600`}>
              No quotes match this filter.
            </div>
          ) : (
            <ul className={`${card} divide-y divide-zinc-100 overflow-hidden`}>
              {visible.map(({ quote, totalCents }) => (
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
                      <span className="text-sm font-semibold tabular-nums text-zinc-900">
                        {formatCents(totalCents)}
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
