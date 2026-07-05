import type { QuoteStatus } from "@/lib/types";

// Shared class recipes so every page uses the same controls.

export const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20";

export const label = "block text-sm font-medium text-zinc-800";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500";

export const card = "rounded-xl border border-zinc-200 bg-white shadow-sm";

export const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

export const STATUS_BADGE: Record<QuoteStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  sent: "bg-blue-50 text-blue-800 ring-blue-200",
  viewed: "bg-amber-50 text-amber-900 ring-amber-300",
  accepted: "bg-green-50 text-green-800 ring-green-300",
  paid: "bg-emerald-700 text-white ring-emerald-700",
};

export const STATUS_DOT: Record<QuoteStatus, string> = {
  draft: "bg-zinc-400",
  sent: "bg-blue-600",
  viewed: "bg-amber-500",
  accepted: "bg-green-600",
  paid: "bg-white",
};
