"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  depositCents,
  formatCents,
  type DepositType,
  type LineItem,
  type LineItemKind,
  type Quote,
} from "@/lib/types";
import { deleteQuote, saveQuote } from "./actions";

type EditableItem = {
  key: number;
  kind: LineItemKind;
  description: string;
  quantity: string; // kept as strings while editing to avoid cursor jumps
  unitPrice: string; // dollars
};

const STATUS_STYLES: Record<Quote["status"], string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
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

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";

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
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0
      ? initialItems.map(toEditable)
      : [{ key: nextKey++, kind: "labor", description: "", quantity: "1", unitPrice: "0.00" }]
  );
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + itemCents(item), 0),
    [items]
  );
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
      {
        key: nextKey++,
        kind,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
      },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
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
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back to dashboard
        </Link>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[quote.status]}`}
        >
          {quote.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Quote {quote.id.slice(0, 8)}
        </h1>
        <div className="flex items-center gap-3">
          <a
            href={`/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            View PDF
          </a>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.kind === "saved"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Client
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input
            aria-label="Client name"
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={inputClass}
          />
          <input
            aria-label="Client email"
            type="email"
            placeholder="client@email.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className={inputClass}
          />
          <input
            aria-label="Client phone"
            type="tel"
            placeholder="Phone"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            className={inputClass}
          />
        </div>
        <textarea
          aria-label="Job description"
          placeholder="Job description — what work is being quoted?"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={3}
          className={`mt-4 ${inputClass}`}
        />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Line items
        </h2>

        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-[6rem_1fr_4.5rem_6rem_6rem_2rem] items-center gap-2 max-sm:grid-cols-2"
            >
              <select
                aria-label="Item type"
                value={item.kind}
                onChange={(e) =>
                  updateItem(item.key, { kind: e.target.value as LineItemKind })
                }
                className={inputClass}
              >
                <option value="labor">Labor</option>
                <option value="material">Material</option>
              </select>
              <input
                aria-label="Item description"
                placeholder={item.kind === "labor" ? "Work performed" : "Material / part"}
                value={item.description}
                onChange={(e) => updateItem(item.key, { description: e.target.value })}
                className={inputClass}
              />
              <input
                aria-label={item.kind === "labor" ? "Hours" : "Quantity"}
                type="number"
                min="0"
                step="0.25"
                title={item.kind === "labor" ? "Hours" : "Quantity"}
                value={item.quantity}
                onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                className={inputClass}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <input
                  aria-label={item.kind === "labor" ? "Hourly rate" : "Unit cost"}
                  type="number"
                  min="0"
                  step="0.01"
                  title={item.kind === "labor" ? "Hourly rate" : "Unit cost"}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                  className={`${inputClass} pl-7`}
                />
              </div>
              <p className="text-right text-sm font-medium text-zinc-900 max-sm:text-left">
                {formatCents(itemCents(item))}
              </p>
              <button
                aria-label="Remove item"
                onClick={() => removeItem(item.key)}
                className="text-zinc-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => addItem("labor")}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            + Labor
          </button>
          <button
            onClick={() => addItem("material")}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            + Material
          </button>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-4">
          <div className="flex items-center justify-between text-base font-semibold text-zinc-900">
            <span>Total</span>
            <span>{formatCents(totalCents)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">Deposit:</span>
              <select
                aria-label="Deposit type"
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as DepositType)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
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
                className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>
            <div className="text-sm text-zinc-600">
              Deposit due:{" "}
              <span className="font-semibold text-zinc-900">
                {formatCents(depositDueCents)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 flex justify-end">
        <form action={deleteQuote.bind(null, quote.id)}>
          <button
            type="submit"
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete quote
          </button>
        </form>
      </div>
    </main>
  );
}
