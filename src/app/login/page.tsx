import Link from "next/link";
import { btnPrimary, card, input, label } from "@/lib/ui";
import { signInWithMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-lg font-bold text-white">
          Q
        </span>
        <span className="text-xl font-semibold tracking-tight text-zinc-900">
          Quote
        </span>
      </Link>

      <div className={`${card} w-full max-w-sm p-8`}>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          We&apos;ll email you a magic link — no password needed.
        </p>

        {sent ? (
          <div
            role="status"
            className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
          >
            Check your email for a sign-in link. You can close this tab.
          </div>
        ) : (
          <form action={signInWithMagicLink} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={`mt-1.5 ${input}`}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                {error}
              </p>
            )}
            <button type="submit" className={`${btnPrimary} w-full`}>
              Send magic link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
