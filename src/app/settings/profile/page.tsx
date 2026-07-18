import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import type { Profile } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { btnPrimary, btnSecondary, card, input, label } from "@/lib/ui";
import { connectStripe, updateProfile } from "./actions";

type StripeStatus = "none" | "incomplete" | "ready" | "unavailable";

async function getStripeStatus(profile: Profile | null): Promise<StripeStatus> {
  if (!profile?.stripe_account_id) return "none";
  try {
    const account = await getStripe().accounts.retrieve(profile.stripe_account_id);
    return account.charges_enabled ? "ready" : "incomplete";
  } catch {
    // Key missing or Stripe unreachable — don't break the settings page.
    return "unavailable";
  }
}

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
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
  const profile = data as Profile | null;

  const depositDisplay =
    profile?.deposit_type === "fixed"
      ? (profile.deposit_value / 100).toFixed(2)
      : String(profile?.deposit_value ?? 25);
  const stripeStatus = await getStripeStatus(profile);

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          This info appears on every quote you send.
        </p>

        {saved && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            Profile saved.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <form action={updateProfile} className={`${card} mt-6 space-y-6 p-6`}>
          <div>
            <label htmlFor="business_name" className={label}>
              Business name
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              defaultValue={profile?.business_name ?? ""}
              placeholder="Smith Plumbing LLC"
              className={`mt-1.5 ${input}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="contact_email" className={label}>
                Contact email
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={profile?.contact_email ?? ""}
                className={`mt-1.5 ${input}`}
              />
            </div>
            <div>
              <label htmlFor="phone" className={label}>
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                className={`mt-1.5 ${input}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="tax_rate" className={label}>
                Sales tax rate (%)
              </label>
              <input
                id="tax_rate"
                name="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={((profile?.default_tax_rate_bps ?? 0) / 100).toString()}
                className={`mt-1.5 ${input}`}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Applied to new quotes. Set 0 if you don&apos;t charge tax.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="default_terms" className={label}>
              Default notes &amp; terms
            </label>
            <textarea
              id="default_terms"
              name="default_terms"
              rows={3}
              defaultValue={profile?.default_terms ?? ""}
              placeholder={"Price valid for 30 days.\nBalance due on completion."}
              className={`mt-1.5 ${input}`}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Shown at the bottom of every quote — you can edit per quote.
            </p>
          </div>

          <fieldset className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-800">
              Default deposit
            </legend>
            <p className="text-xs text-zinc-600">
              Applied to new quotes — you can adjust it on each quote too.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="deposit_type" className={label}>
                  Type
                </label>
                <select
                  id="deposit_type"
                  name="deposit_type"
                  defaultValue={profile?.deposit_type ?? "percent"}
                  className={`mt-1.5 ${input}`}
                >
                  <option value="percent">Percent of total</option>
                  <option value="fixed">Fixed amount ($)</option>
                </select>
              </div>
              <div>
                <label htmlFor="deposit_value" className={label}>
                  Value
                </label>
                <input
                  id="deposit_value"
                  name="deposit_value"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={depositDisplay}
                  className={`mt-1.5 ${input}`}
                />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <button type="submit" className={btnPrimary}>
              Save profile
            </button>
          </div>
        </form>

        <section className={`${card} mt-6 p-6`}>
          <h2 className="text-base font-semibold text-zinc-900">Payments</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Connect your own Stripe account so clients can pay deposits online.
            Money goes directly to you — never through Quote.
          </p>

          <div className="mt-4">
            {stripeStatus === "ready" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                  <span className="h-2 w-2 rounded-full bg-green-600" />
                  Connected — ready to accept deposits
                </p>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnSecondary}
                >
                  Open Stripe dashboard
                </a>
              </div>
            )}
            {stripeStatus === "incomplete" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                  Onboarding started but not finished — deposits can&apos;t be
                  accepted yet.
                </p>
                <form action={connectStripe}>
                  <button type="submit" className={btnPrimary}>
                    Finish Stripe setup
                  </button>
                </form>
              </div>
            )}
            {stripeStatus === "none" && (
              <form action={connectStripe}>
                <button type="submit" className={btnPrimary}>
                  Connect Stripe
                </button>
              </form>
            )}
            {stripeStatus === "unavailable" && (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Stripe status couldn&apos;t be checked right now. Try again in a
                minute.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
