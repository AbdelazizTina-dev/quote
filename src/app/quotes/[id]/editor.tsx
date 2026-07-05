"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { deleteQuote, markSent, saveQuote } from "./actions";

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

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveQuote(quote.id, {
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
      });
      setMessage(
        result.ok
          ? { kind: "saved", text: "Quote saved." }
          : { kind: "error", text: result.error }
      );
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
          <a
            href={`/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnSecondary}
          >
            View PDF
          </a>
          <button onClick={handleSave} disabled={isPending} className={btnPrimary}>
            {isPending ? "Saving…" : "Save"}
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
                onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
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
                  onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50 p-4 ring-1 ring-inset ring-blue-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-blue-950">Deposit:</span>
              <select
                aria-label="Deposit type"
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as DepositType)}
                className="rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              >
                <option value="percent">% of total</option>
                <option value="fixed">Fixed $</option>
              </select>
              <input
                aria-label="Deposit value"
                type="number"
                min="0"
                step={depositType === "fixed" ? "0.01" : "1"}
                value={depositValue}
                onChange={(e) => setDepositValue(e.target.value)}
                className="w-24 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              />
            </div>
            <div className="text-sm text-blue-950">
              Deposit due:{" "}
              <span className="text-base font-bold tabular-nums">
                {formatCents(depositDueCents)}
              </span>
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
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Delete quote
          </button>
        </form>
      </div>
    </main>
  );
}
