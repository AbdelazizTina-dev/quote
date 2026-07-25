import { redirect } from "next/navigation";
import { accessInfo, PRICE_CENTS, TRIAL_DAYS } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { formatCents, type Profile } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { SubmitButton } from "@/components/submit-button";
import { card } from "@/lib/ui";
import { openBillingPortal, startSubscription } from "./actions";

// Keeps the DB in sync with Stripe on every billing-page visit (covers
// cancellations/renewals without depending solely on webhooks). Returns
// cancel_at_period_end live — "active but ending" renders differently
// from "active and renewing".
async function syncSubscription(
  profile: Profile
): Promise<{ profile: Profile; cancelAtPeriodEnd: boolean }> {
  if (!profile.stripe_customer_id) return { profile, cancelAtPeriodEnd: false };
  try {
    const subs = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 1,
    });
    const sub = subs.data[0];
    const status = sub?.status ?? "none";
    const cancelAtPeriodEnd = sub?.cancel_at_period_end ?? false;
    const periodEnd = sub?.items.data[0]?.current_period_end;
    const periodEndIso = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null;
    if (
      status !== profile.subscription_status ||
      periodEndIso !== profile.subscription_period_end
    ) {
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({
          subscription_status: status,
          subscription_period_end: periodEndIso,
        })
        .eq("id", profile.id);
      return {
        profile: {
          ...profile,
          subscription_status: status,
          subscription_period_end: periodEndIso,
        },
        cancelAtPeriodEnd,
      };
    }
    return { profile, cancelAtPeriodEnd };
  } catch {
    // Stripe unreachable — show last-known status.
  }
  return { profile, cancelAtPeriodEnd: false };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; session_id?: string; locked?: string }>;
}) {
  const { error, session_id: sessionId, locked } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!data) redirect("/dashboard");

  const { profile, cancelAtPeriodEnd } = await syncSubscription(data as Profile);
  const access = accessInfo(profile);
  const justSubscribed = Boolean(sessionId) && access.subscribed;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          One flat price. No usage tiers, no surprises.
        </p>

        {justSubscribed && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            ✓ You&apos;re subscribed — thanks! Quotes are unlimited from here on.
          </p>
        )}
        {locked && !access.active && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            Your free trial has ended. Subscribe below to keep creating and
            sending quotes — your existing quotes and client links still work.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <section className={`${card} mt-6 p-6`}>
          {access.subscribed ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-zinc-900">
                    Quote subscription — {formatCents(PRICE_CENTS)}/month
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Status:{" "}
                    <span
                      className={`font-medium ${
                        cancelAtPeriodEnd ? "text-amber-700" : "text-green-700"
                      }`}
                    >
                      {cancelAtPeriodEnd
                        ? "cancelled"
                        : profile.subscription_status}
                    </span>
                    {profile.subscription_period_end && (
                      <>
                        {" "}
                        · {cancelAtPeriodEnd ? "access until" : "renews"}{" "}
                        {new Date(
                          profile.subscription_period_end
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </>
                    )}
                  </p>
                </div>
                <form action={openBillingPortal}>
                  <SubmitButton variant="secondary" pendingLabel="Opening portal…">
                    {cancelAtPeriodEnd ? "Resubscribe" : "Manage subscription"}
                  </SubmitButton>
                </form>
              </div>
              {cancelAtPeriodEnd ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Your subscription is cancelled and won&apos;t renew. You keep
                  full access until the date above — reactivate anytime from the
                  portal.
                </p>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  Update your card, download invoices, or cancel anytime —
                  changes take effect at the end of the billing period.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-base font-semibold text-zinc-900">
                  Quote subscription
                </p>
                <p className="text-2xl font-bold text-zinc-900">
                  {formatCents(PRICE_CENTS)}
                  <span className="text-sm font-medium text-zinc-500">
                    /month
                  </span>
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                <li>✓ Unlimited quotes and client links</li>
                <li>✓ Online deposit collection via your own Stripe account</li>
                <li>✓ Branded PDFs, email sending, and status tracking</li>
              </ul>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-600">
                  {access.trialDaysLeft > 0 ? (
                    <>
                      Free trial:{" "}
                      <span className="font-semibold text-zinc-900">
                        {access.trialDaysLeft} day
                        {access.trialDaysLeft === 1 ? "" : "s"} left
                      </span>{" "}
                      of {TRIAL_DAYS}
                    </>
                  ) : (
                    <span className="font-semibold text-red-700">
                      Trial ended
                    </span>
                  )}
                </p>
                <form action={startSubscription}>
                  <SubmitButton pendingLabel="Opening checkout…">
                    Subscribe — {formatCents(PRICE_CENTS)}/month
                  </SubmitButton>
                </form>
              </div>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Deposits from your clients always go directly to your Stripe account —
          this subscription is the only thing Quote ever charges you.
        </p>
      </main>
    </>
  );
}
