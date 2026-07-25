"use client";

import { useFormStatus } from "react-dom";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const VARIANTS = {
  primary: btnPrimary,
  secondary: btnSecondary,
  danger:
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50",
} as const;

function Spinner() {
  return (
    <svg
      className="mr-2 h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// Drop-in submit button for server-action forms: disables itself and shows
// a spinner while the action runs, so clicks always visibly do something.
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  confirmMessage,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof VARIANTS;
  confirmMessage?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={
        confirmMessage
          ? (e) => {
              if (!window.confirm(confirmMessage)) e.preventDefault();
            }
          : undefined
      }
      className={`${VARIANTS[variant]} ${className ?? ""}`}
    >
      {pending && <Spinner />}
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
