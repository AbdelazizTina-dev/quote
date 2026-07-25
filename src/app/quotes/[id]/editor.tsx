"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  depositCents,
  formatCents,
  taxCents,
  type DepositType,
  type LineItem,
  type LineItemKind,
  type Quote,
} from "@/lib/types";
import { btnPrimary, btnSecondary, card, input } from "@/lib/ui";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteQuote,
  duplicateQuote,
  markSent,
  saveQuote,
  sendQuote,
  type QuotePayload,
} from "./actions";

// Typing into a focused number field should replace the value, not append.
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) =>
  e.currentTarget.select();

const DEPOSIT_PRESETS = [10, 25, 50];

type EditableItem = {
  key: number;
  kind: LineItemKind;
  description: string;
  quantity: string; // kept as strings while editing to avoid cursor jumps
  unitPrice: string; // dollars
};

let nextKey = 1;

function toEditable(item: LineItem): EditableItem {
  return {
    key: nextKey++,
    kind: item.kind,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: (item.unit_price_cents / 100).toFixed(2),
  };
}

function itemCents(item: EditableItem): number {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  return Math.round(qty * price * 100);
}

const itemGrid =
  "grid grid-cols-[6.5rem_1fr_5rem_6.5rem_5.5rem_2rem] items-center gap-2 max-sm:grid-cols-2";

export function QuoteEditor({
  quote,
  initialItems,
}: {
  quote: Quote;
  initialItems: LineItem[];
}) {
  const [clientName, setClientName] = useState(quote.client_name);
  const [clientEmail, setClientEmail] = useState(quote.client_email ?? "");
  const [clientPhone, setClientPhone] = useState(quote.client_phone ?? "");
  const [jobDescription, setJobDescription] = useState(quote.job_description);
  const [depositType, setDepositType] = useState<DepositType>(quote.deposit_type);
  const [depositValue, setDepositValue] = useState(
    quote.deposit_type === "fixed"
      ? (quote.deposit_value / 100).toFixed(2)
      : String(quote.deposit_value)
  );
  const [taxRate, setTaxRate] = useState(String(quote.tax_rate_bps / 100));
  const [terms, setTerms] = useState(quote.terms);
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0
      ? initialItems.map(toEditable)
      : [{ key: nextKey++, kind: "labor", description: "", quantity: "1", unitPrice: "0.00" }]
  );
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + itemCents(item), 0),
    [items]
  );
  const taxRateBps = Math.round((parseFloat(taxRate) || 0) * 100);
  const taxDueCents = taxCents(subtotalCents, taxRateBps);
  const totalCents = subtotalCents + taxDueCents;
  const depositDueCents = useMemo(() => {
    const value = parseFloat(depositValue) || 0;
    return depositCents(
      totalCents,
      depositType,
      depositType === "fixed" ? Math.round(value * 100) : value
    );
  }, [totalCents, depositType, depositValue]);

  function updateItem(key: number, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function addItem(kind: LineItemKind) {
    setItems((prev) => [
      ...prev,
      { key: nextKey++, kind, description: "", quantity: "1", unitPrice: "0.00" },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/q/${quote.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (quote.status === "draft") {
      startTransition(async () => {
        const result = await markSent(quote.id);
        if (result.ok) {
          router.refresh();
        } else {
          setMessage({ kind: "error", text: result.error });
        }
      });
    }
  }

  const payloadJson = JSON.stringify(buildPayload());
  // Initialized on first render == the state as loaded from the server.
  const [savedJson, setSavedJson] = useState(payloadJson);
  const isDirty = payloadJson !== savedJson;

  // Warn before navigating away with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function buildPayload(): QuotePayload {
    return {
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      job_description: jobDescription,
      deposit_type: depositType,
      deposit_value:
        depositType === "fixed"
          ? Math.round((parseFloat(depositValue) || 0) * 100)
          : Math.round(parseFloat(depositValue) || 0),
      tax_rate_bps: taxRateBps,
      terms,
      items: items.map((item) => ({
        kind: item.kind,
        description: item.description,
        quantity: parseFloat(item.quantity) || 0,
        unit_price_cents: Math.round((parseFloat(item.unitPrice) || 0) * 100),
      })),
    };
  }

  function handleSave() {
    setMessage(null);
    const current = buildPayload();
    const currentJson = JSON.stringify(current);
    startTransition(async () => {
      const result = await saveQuote(quote.id, current);
      if (result.ok) setSavedJson(currentJson);
      setMessage(
        result.ok
          ? { kind: "saved", text: "Quote saved." }
          : { kind: "error", text: result.error }
      );
    });
  }

  function handleEmailQuote() {
    setMessage(null);
    const current = buildPayload();
    const currentJson = JSON.stringify(current);
    startTransition(async () => {
      const saved = await saveQuote(quote.id, current);
      if (!saved.ok) {
        setMessage({ kind: "error", text: saved.error });
        return;
      }
      setSavedJson(currentJson);
      const sent = await sendQuote(quote.id);
      if (sent.ok) {
        setMessage({ kind: "saved", text: `Quote emailed to ${clientEmail}.` });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: sent.error });
      }
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          &larr; Dashboard
        </Link>
        <StatusBadge status={quote.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Quote{" "}
          <span className="font-mono text-lg font-medium text-zinc-500">
            #{quote.id.slice(0, 8).toUpperCase()}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <form action={duplicateQuote.bind(null, quote.id)}>
            <SubmitButton variant="secondary" pendingLabel="Duplicating…">
              Duplicate
            </SubmitButton>
          </form>
          <a
            href={`/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnSecondary}
          >
            View PDF
          </a>
          <button
            onClick={handleSave}
            disabled={isPending || !isDirty}
            className={btnPrimary}
          >
            {isPending ? "Saving…" : isDirty ? "Save changes" : "Saved ✓"}
          </button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg border p-3 text-sm font-medium ${
            message.kind === "saved"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className={`${card} mt-6 flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">Client link</p>
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            /q/{quote.token}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quote.status !== "draft" && (
            <a
              href={`/q/${quote.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Preview
            </a>
          )}
          <button onClick={handleCopyLink} className={btnSecondary}>
            {copied ? "Copied ✓" : "Copy client link"}
          </button>
          <button
            onClick={handleEmailQuote}
            disabled={isPending || !clientEmail.trim()}
            title={!clientEmail.trim() ? "Add the client's email first" : undefined}
            className={btnPrimary}
          >
            {isPending ? "Working…" : "Email to client"}
          </button>
        </div>
        {quote.status === "draft" && (
          <p className="w-full text-xs text-zinc-500">
            Copying the link marks this quote as <strong>sent</strong> and makes
            it visible to anyone with the link.
          </p>
        )}
      </section>

      <section className={`${card} mt-6 p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Client
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input
            aria-label="Client name"
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={input}
          />
          <input
            aria-label="Client email"
            type="email"
            placeholder="client@email.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className={input}
          />
          <input
            aria-label="Client phone"
            type="tel"
            placeholder="Phone"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            className={input}
          />
        </div>
        <textarea
          aria-label="Job description"
          placeholder="Job description — what work is being quoted?"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={3}
          className={`mt-4 ${input}`}
        />
      </section>

      <section className={`${card} mt-6 p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Line items
        </h2>

        <div
          className={`${itemGrid} mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 max-sm:hidden`}
        >
          <span>Type</span>
          <span>Description</span>
          <span>Qty / hrs</span>
          <span>Rate / cost</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.key} className={itemGrid}>
              <select
                aria-label="Item type"
                value={item.kind}
                onChange={(e) =>
                  updateItem(item.key, { kind: e.target.value as LineItemKind })
                }
                className={input}
              >
                <option value="labor">Labor</option>
                <option value="material">Material</option>
              </select>
              <input
                aria-label="Item description"
                placeholder={item.kind === "labor" ? "Work performed" : "Material / part"}
                value={item.description}
                onChange={(e) => updateItem(item.key, { description: e.target.value })}
                className={input}
              />
              <input
                aria-label={item.kind === "labor" ? "Hours" : "Quantity"}
                type="number"
                min="0"
                step="0.25"
                value={item.quantity}
                onFocus={selectOnFocus}
                onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                onBlur={() =>
                  updateItem(item.key, {
                    quantity: String(parseFloat(item.quantity) || 0),
                  })
                }
                className={input}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  $
                </span>
                <input
                  aria-label={item.kind === "labor" ? "Hourly rate" : "Unit cost"}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onFocus={selectOnFocus}
                  onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                  onBlur={() =>
                    updateItem(item.key, {
                      unitPrice: (parseFloat(item.unitPrice) || 0).toFixed(2),
                    })
                  }
                  className={`${input} pl-7`}
                />
              </div>
              <p className="text-right text-sm font-semibold tabular-nums text-zinc-900 max-sm:text-left">
                {formatCents(itemCents(item))}
              </p>
              <button
                aria-label="Remove item"
                onClick={() => removeItem(item.key)}
                className="justify-self-center rounded p-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={() => addItem("labor")} className={btnSecondary}>
            + Labor
          </button>
          <button onClick={() => addItem("material")} className={btnSecondary}>
            + Material
          </button>
        </div>

        <div className="mt-6 space-y-4 border-t border-zinc-200 pt-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-zinc-700">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCents(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-zinc-700">
              <span className="flex items-center gap-2">
                Tax
                <span className="relative">
                  <input
                    aria-label="Tax rate percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onFocus={selectOnFocus}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-20 rounded-lg border border-zinc-300 bg-white py-1 pl-2 pr-6 text-sm text-zinc-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500">
                    %
                  </span>
                </span>
              </span>
              <span className="tabular-nums">{formatCents(taxDueCents)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
              <span className="text-base font-semibold text-zinc-900">Total</span>
              <span className="text-xl font-bold tabular-nums text-zinc-900">
                {formatCents(totalCents)}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 ring-1 ring-inset ring-blue-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-blue-950">
                Deposit required to accept
              </p>
              <p className="text-sm text-blue-950">
                Client pays:{" "}
                <span className="text-lg font-bold tabular-nums">
                  {formatCents(depositDueCents)}
                </span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {DEPOSIT_PRESETS.map((preset) => {
                const active =
                  depositType === "percent" &&
                  Math.round(parseFloat(depositValue) || 0) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDepositType("percent");
                      setDepositValue(String(preset));
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-700 text-white"
                        : "bg-white text-blue-900 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    {preset}%
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  if (depositType !== "fixed") {
                    setDepositType("fixed");
                    // Sensible starting point: ~25% of the current total.
                    setDepositValue(
                      totalCents > 0
                        ? (Math.round(totalCents * 0.25) / 100).toFixed(2)
                        : "100.00"
                    );
                  }
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  depositType === "fixed"
                    ? "bg-blue-700 text-white"
                    : "bg-white text-blue-900 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                }`}
              >
                Fixed $
              </button>
              <div className="relative">
                {depositType === "fixed" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-blue-900/60">
                    $
                  </span>
                )}
                <input
                  aria-label={
                    depositType === "fixed"
                      ? "Deposit amount in dollars"
                      : "Deposit percent of total"
                  }
                  type="number"
                  min="0"
                  step={depositType === "fixed" ? "0.01" : "1"}
                  value={depositValue}
                  onFocus={selectOnFocus}
                  onChange={(e) => setDepositValue(e.target.value)}
                  onBlur={() =>
                    setDepositValue(
                      depositType === "fixed"
                        ? (parseFloat(depositValue) || 0).toFixed(2)
                        : String(Math.round(parseFloat(depositValue) || 0))
                    )
                  }
                  className={`w-28 rounded-lg border border-blue-200 bg-white py-1.5 text-sm text-zinc-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 ${
                    depositType === "fixed" ? "pl-7 pr-2" : "pl-3 pr-8"
                  }`}
                />
                {depositType === "percent" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-900/60">
                    %
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${card} mt-6 p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Notes &amp; terms
        </h2>
        <textarea
          aria-label="Notes and terms"
          placeholder={"Price valid for 30 days.\nBalance due on completion."}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          className={`mt-4 ${input}`}
        />
        <p className="mt-2 text-xs text-zinc-500">
          Shown at the bottom of the quote your client sees.
        </p>
      </section>

      <div className="mt-8 flex justify-end">
        <form action={deleteQuote.bind(null, quote.id)}>
          <SubmitButton
            variant="danger"
            pendingLabel="Deleting…"
            confirmMessage="Delete this quote? The client link will stop working and this can't be undone."
          >
            Delete quote
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
