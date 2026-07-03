import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
        Business profile
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        This info appears on every quote you send.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Profile saved.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={updateProfile} className="mt-6 space-y-5">
        <div>
          <label htmlFor="business_name" className="block text-sm font-medium text-zinc-700">
            Business name
          </label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            required
            defaultValue={profile?.business_name ?? ""}
            placeholder="Smith Plumbing LLC"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-zinc-700">
              Contact email
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile?.contact_email ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
        </div>

        <fieldset className="rounded-lg border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-medium text-zinc-700">
            Default deposit
          </legend>
          <p className="text-xs text-zinc-500">
            Applied to new quotes. You can change it per quote later.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="deposit_type" className="block text-sm font-medium text-zinc-700">
                Type
              </label>
              <select
                id="deposit_type"
                name="deposit_type"
                defaultValue={profile?.deposit_type ?? "percent"}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              >
                <option value="percent">Percent of total</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div>
              <label htmlFor="deposit_value" className="block text-sm font-medium text-zinc-700">
                Value
              </label>
              <input
                id="deposit_value"
                name="deposit_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={depositDisplay}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Save profile
        </button>
      </form>
    </main>
  );
}
