// Resend via its plain HTTP API — no SDK dependency.
// (Postmark requires a company email domain to even register an account.)
// All senders degrade gracefully when RESEND_API_KEY isn't configured:
// quote emails report the problem, notifications no-op.

type SendResult = { ok: true } | { ok: false; error: string };

// Resend's shared test sender works with no domain setup, but only
// delivers to the address that owns the Resend account. Verify a domain
// and set EMAIL_FROM to send to real clients.
const DEFAULT_FROM = "Quote <onboarding@resend.dev>";

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Email isn't configured yet (set RESEND_API_KEY). Copy the client link instead.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: body?.message ?? `Email failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Email service unreachable" };
  }
}

const wrap = (content: string) => `
<div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
  ${content}
  <p style="margin-top: 32px; font-size: 12px; color: #a1a1aa;">Sent with Quote</p>
</div>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display: inline-block; background: #1d4ed8; color: #ffffff; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">${label}</a>`;

export function quoteEmail(opts: {
  businessName: string;
  clientName: string;
  totalFormatted: string;
  depositFormatted: string;
  link: string;
}) {
  const { businessName, clientName, totalFormatted, depositFormatted, link } = opts;
  return {
    subject: `${businessName} sent you a quote — ${totalFormatted}`,
    html: wrap(`
      <h2 style="margin: 0 0 16px;">${businessName} sent you a quote</h2>
      <p>Hi ${clientName || "there"},</p>
      <p>${businessName} has prepared a quote for you. The total is <strong>${totalFormatted}</strong>, with a <strong>${depositFormatted}</strong> deposit to accept and book the work.</p>
      <p style="margin: 24px 0;">${button(link, "View quote")}</p>
      <p style="font-size: 13px; color: #52525b;">You can review the full itemized quote, download a PDF, and accept online. If the button doesn't work, open this link:<br>${link}</p>
    `),
    text: `${businessName} sent you a quote.\n\nTotal: ${totalFormatted}\nDeposit to accept: ${depositFormatted}\n\nView and accept: ${link}`,
  };
}

export function notificationEmail(opts: {
  event: "viewed" | "paid";
  clientName: string;
  quoteRef: string;
  depositFormatted?: string;
  link: string;
}) {
  const { event, clientName, quoteRef, depositFormatted, link } = opts;
  const who = clientName || "Your client";
  if (event === "paid") {
    return {
      subject: `💰 ${who} accepted quote ${quoteRef} and paid the deposit`,
      html: wrap(`
        <h2 style="margin: 0 0 16px;">Quote accepted — deposit paid</h2>
        <p><strong>${who}</strong> accepted quote <strong>${quoteRef}</strong>${depositFormatted ? ` and paid the <strong>${depositFormatted}</strong> deposit` : ""}. The money is on its way to your Stripe account.</p>
        <p style="margin: 24px 0;">${button(link, "Open quote")}</p>
      `),
      text: `${who} accepted quote ${quoteRef}${depositFormatted ? ` and paid the ${depositFormatted} deposit` : ""}.\n\n${link}`,
    };
  }
  return {
    subject: `👀 ${who} viewed quote ${quoteRef}`,
    html: wrap(`
      <h2 style="margin: 0 0 16px;">Your quote was viewed</h2>
      <p><strong>${who}</strong> just opened quote <strong>${quoteRef}</strong>. Good time to follow up if you don't hear back soon.</p>
      <p style="margin: 24px 0;">${button(link, "Open quote")}</p>
    `),
    text: `${who} viewed quote ${quoteRef}.\n\n${link}`,
  };
}
