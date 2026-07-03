import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Professional quotes.
          <br />
          Deposits on the spot.
        </h1>
        <p className="mt-4 text-lg text-zinc-600">
          Turn a job estimate into an itemized PDF quote your client can accept
          and pay a deposit on — from one link. Just the quote and the deposit,
          none of the bloat.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
