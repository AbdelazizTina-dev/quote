import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { btnPrimary, card, input, label } from "@/lib/ui";
import { updateProfile } from "./actions";

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
      </main>
    </>
  );
}
