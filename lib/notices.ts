import { timingSafeEqual } from "crypto";
import type { ValidQuote } from "@/lib/quote";
import { listReminderQuotes, readStoredQuote, setQuoteNotice, type StoredQuote } from "@/lib/sheet";
import { sendTelegram, type TelegramResult } from "@/lib/telegram";
import { ORDER_CONFIRMATION_TEMPLATE_KEY, sendTemplateEmail, sendTransactionalEmail, type MailResult } from "@/lib/zoho";

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function htmlOf(lines: string[]): string {
  return `<div>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
}

function logMail(kind: string, result: MailResult): void {
  if (result.ok) return;
  if (result.reason === "rejected") console.error(kind, result.httpStatus, result.errorCode);
  else console.error(kind, result.reason);
}

function logTelegram(kind: string, result: TelegramResult): void {
  if (result.ok) return;
  if (result.reason === "rejected") console.error(kind, result.httpStatus, result.errorCode);
  else console.error(kind, result.reason);
}

export function serviceDateTomorrow(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${next.getUTCFullYear()}`;
}

export function bookingMessage(quote: ValidQuote, quoteId: string): string {
  return [
    "New booking",
    `Name: ${oneLine(quote.name)}`,
    `Route: ${oneLine(quote.pickup)} to ${oneLine(quote.dropoff)}`,
    `Date: ${oneLine(quote.date)} ${oneLine(quote.time)}`,
    `Quote: ${oneLine(quoteId)}`,
  ].join("\n");
}

export function paymentMessage(quoteId: string, amountUsd: number | null): string {
  const amount = amountUsd == null ? "unknown" : `USD ${amountUsd}`;
  return ["Payment received", `Quote: ${oneLine(quoteId)}`, `Amount: ${amount}`].join("\n");
}

function quotedPrice(quote: ValidQuote): string | null {
  if (quote.price.status === "quoted" && quote.price.usd != null) return `Price: USD ${quote.price.usd}`;
  return null;
}

export async function deliverBookingNotices(quote: ValidQuote, quoteId: string): Promise<void> {
  const lines = [
    `Hello ${oneLine(quote.name)},`,
    "We saved your transfer request.",
    `Route: ${oneLine(quote.pickup)} to ${oneLine(quote.dropoff)}`,
    `Date: ${oneLine(quote.date)} ${oneLine(quote.time)}`,
    `Passengers: ${quote.passengers}`,
    `Vehicle: ${oneLine(quote.vehicle.name)}`,
    quotedPrice(quote),
    `Quote: ${oneLine(quoteId)}`,
  ].filter((line): line is string => Boolean(line));
  try {
    const email = await sendTransactionalEmail({
      to: quote.email,
      toName: quote.name,
      subject: "Your Paris transfer request",
      text: lines.join("\n"),
      html: htmlOf(lines),
      clientReference: quoteId,
    });
    logMail("zoho confirmation was not sent", email);
  } catch {
    console.error("zoho confirmation was not sent", "network");
  }
  try {
    const telegram = await sendTelegram(bookingMessage(quote, quoteId));
    logTelegram("telegram booking was not sent", telegram);
  } catch {
    console.error("telegram booking was not sent", "network");
  }
}

const SITE = "https://www.transportinparis.com";

function usdAmount(amountUsd: number | null, priceUsd: string): string {
  if (amountUsd != null && Number.isFinite(amountUsd)) {
    return `USD ${Number.isInteger(amountUsd) ? String(amountUsd) : amountUsd.toFixed(2)}`;
  }
  const stored = oneLine(priceUsd);
  return stored ? `USD ${stored}` : "USD —";
}

function serviceLabel(service: string): string {
  const value = oneLine(service);
  if (value === "airport") return "Airport";
  if (value === "private") return "Private trip";
  if (value === "hourly") return "Hourly";
  return value;
}

export function paymentOrderMerge(quote: StoredQuote, quoteId: string, amountUsd: number | null): Record<string, string> {
  return {
    "Booking ID": oneLine(quoteId),
    "First Name": oneLine(quote.name),
    Service: serviceLabel(quote.service),
    Date: oneLine(quote.date),
    "Pickup Time": oneLine(quote.time),
    "Pickup Address and Meeting Point": oneLine(quote.pickup),
    "Drop-off Address": oneLine(quote.dropoff),
    "Flight Number": oneLine(quote.flight),
    Passengers: oneLine(quote.passengers),
    Luggage: oneLine(quote.luggage),
    Vehicle: oneLine(quote.vehicle),
    "Total Price": usdAmount(amountUsd, quote.priceUsd),
    "Payment Status": "paid",
    "Company Legal Name": "Travel Kif SAS",
    "Company Address": "Based in Paris",
    "Cancellation Policy Link": `${SITE}/#faq`,
    "Privacy Policy URL": `${SITE}/`,
    "Manage Booking URL": `${SITE}/#quote`,
    "Unsubscribe URL": "mailto:bonjour@transportinparis.com",
  };
}

export async function deliverPaymentNotices(input: { quoteId: string; amountUsd: number | null; receiptUrl: string }): Promise<void> {
  if (!input.quoteId) return;
  let stored: StoredQuote | null = null;
  try {
    stored = await readStoredQuote(input.quoteId);
  } catch {
    console.error("payment notice sheet read failed");
    return;
  }
  if (!stored) return;
  if (stored.invoiceSent !== "yes" && stored.email) {
    try {
      const email = await sendTemplateEmail({
        to: stored.email,
        toName: stored.name,
        templateKey: ORDER_CONFIRMATION_TEMPLATE_KEY,
        mergeInfo: paymentOrderMerge(stored, input.quoteId, input.amountUsd),
        clientReference: `${input.quoteId}-order`,
      });
      if (email.ok) {
        const marked = await setQuoteNotice(input.quoteId, "invoice_sent", "yes").catch(() => false);
        if (!marked) console.error("order confirmation notice was not marked");
      } else {
        logMail("zoho order confirmation was not sent", email);
      }
    } catch {
      console.error("zoho order confirmation was not sent", "network");
    }
  }
  if (stored.paymentNoticeSent !== "yes") {
    try {
      const telegram = await sendTelegram(paymentMessage(input.quoteId, input.amountUsd));
      if (telegram.ok) {
        const marked = await setQuoteNotice(input.quoteId, "payment_notice_sent", "yes").catch(() => false);
        if (!marked) console.error("payment notice was not marked");
      } else {
        logTelegram("telegram payment was not sent", telegram);
      }
    } catch {
      console.error("telegram payment was not sent", "network");
    }
  }
}

function reminderLines(quote: StoredQuote): string[] {
  return [
    `Hello ${oneLine(quote.name) || "there"},`,
    "This is a reminder that your Paris pickup is tomorrow.",
    `Route: ${oneLine(quote.pickup)} to ${oneLine(quote.dropoff)}`,
    `Date: ${oneLine(quote.date)} ${oneLine(quote.time)}`,
    `Passengers: ${oneLine(quote.passengers)}`,
    `Vehicle: ${oneLine(quote.vehicle)}`,
    `Quote: ${oneLine(quote.quoteId)}`,
  ];
}

export async function deliverServiceReminders(now = new Date()): Promise<{ date: string; sent: number; failed: number }> {
  const date = serviceDateTomorrow(now);
  const due = await listReminderQuotes(date);
  let sent = 0;
  let failed = 0;
  for (const quote of due) {
    if (!quote.email) {
      failed += 1;
      continue;
    }
    try {
      const lines = reminderLines(quote);
      const email = await sendTransactionalEmail({
        to: quote.email,
        toName: quote.name,
        subject: "Reminder: your Paris pickup is tomorrow",
        text: lines.join("\n"),
        html: htmlOf(lines),
        clientReference: `${quote.quoteId}-reminder`,
      });
      if (!email.ok) {
        logMail("zoho reminder was not sent", email);
        failed += 1;
        continue;
      }
      const marked = await setQuoteNotice(quote.quoteId, "reminder_sent", "yes").catch(() => false);
      if (marked) sent += 1;
      else failed += 1;
    } catch {
      console.error("zoho reminder was not sent", "network");
      failed += 1;
    }
  }
  return { date, sent, failed };
}

export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  const expected = (secret || "").trim();
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
