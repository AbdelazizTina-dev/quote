import Link from "next/link";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
            Q
          </span>
          <span className="text-base font-semibold tracking-tight text-zinc-900">
            Quote
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Dashboard
          </Link>
          <Link
            href="/settings/profile"
            className="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Settings
          </Link>
          <Link
            href="/settings/billing"
            className="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Billing
          </Link>
          <span className="mx-2 hidden text-zinc-300 sm:inline">|</span>
          {email && (
            <span className="hidden max-w-40 truncate text-zinc-500 sm:inline" title={email}>
              {email}
            </span>
          )}
          <form action="/auth/signout" method="post" className="ml-2">
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
