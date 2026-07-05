import Link from "next/link";
import { btnPrimary } from "@/lib/ui";

const FEATURES = [
  {
    icon: "🧾",
    title: "Itemized PDF quotes",
    body: "Labor and materials broken out line by line, on a branded, professional PDF — not a text message.",
  },
  {
    icon: "🔗",
    title: "One link for your client",
    body: "Send a secure link. Your client opens it on any device — no app, no account, no login.",
  },
  {
    icon: "💵",
    title: "Deposits on the spot",
    body: "Clients accept and pay the deposit right from the quote, straight into your Stripe account.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
              Q
            </span>
            <span className="text-base font-semibold tracking-tight text-zinc-900">
              Quote
            </span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-zinc-100 px-4 py-20">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Professional quotes.
            <br />
            <span className="text-blue-700">Deposits on the spot.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-zinc-600">
            For solo plumbers, electricians, and handymen: turn a job estimate
            into an itemized PDF quote your client can accept and pay a deposit
            on — from one link.
          </p>
          <div className="mt-8">
            <Link href="/login" className={`${btnPrimary} px-8 py-3 text-base`}>
              Get started free
            </Link>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Just the quote and the deposit — none of the bloat.
          </p>
        </div>

        <div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <p className="text-2xl" aria-hidden>
                {feature.icon}
              </p>
              <h2 className="mt-3 text-sm font-semibold text-zinc-900">
                {feature.title}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
        Quote — professional quotes for solo trade businesses
      </footer>
    </div>
  );
}
