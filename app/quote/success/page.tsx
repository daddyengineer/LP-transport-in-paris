import type { Metadata } from "next";
import { deliverPaymentNotices } from "@/lib/notices";
import { markQuotePaid, sheetConfigured } from "@/lib/sheet";
import { checkoutConnected, readPaidSession } from "@/lib/stripe";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function QuoteSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId = "" } = await searchParams;
  if (!checkoutConnected()) {
    return (
      <main style={card}>
        <h1>Checkout is not connected</h1>
        <p>No card was charged. Card numbers are never entered on this site.</p>
        <a href="/#quote">Back to the quote</a>
      </main>
    );
  }
  const session = await readPaidSession(sessionId);
  if (!session) {
    return (
      <main style={card}>
        <h1>We could not read this Checkout session</h1>
        <p>No card number is shown here. Payment details stay on Stripe.</p>
        <a href="/#quote">Back to the quote</a>
      </main>
    );
  }
  let sheetNote = "";
  if (session.paid && session.quoteId) {
    try {
      const updated = sheetConfigured() ? await markQuotePaid(session.quoteId) : false;
      sheetNote = updated ? "This quote is marked paid." : "Stripe confirmed the payment. The sheet row was not updated.";
    } catch {
      sheetNote = "Stripe confirmed the payment. The sheet row was not updated.";
    }
    try {
      await deliverPaymentNotices({ quoteId: session.quoteId, amountUsd: session.amountUsd, receiptUrl: session.receiptUrl });
    } catch {
      console.error("payment notices were not sent");
    }
  }
  const amount = session.amountUsd == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(session.amountUsd);
  return (
    <main style={card}>
      <h1>{session.paid ? "Payment received" : "Payment not completed"}</h1>
      <p>Amount <strong>{amount}</strong></p>
      <p>Quote <strong>{session.quoteId || "—"}</strong></p>
      {sheetNote ? <p>{sheetNote}</p> : null}
      <p>Card, Apple Pay, and Google Pay stay on Stripe. This page does not show a card number.</p>
      {session.paid ? <p>Thank you for your order. You will receive an order confirmation at the corresponding email shortly.</p> : null}
      <div style={actions}>
        <a href="/#quote">Back to the quote</a>
        <a href="https://www.transportinparis.com/" style={homeButton}>Back to homepage</a>
      </div>
      <p style={stripeMark}>
        <img src="/icons/shield.svg" alt="" width={22} height={22} />
        <img src="/pay/stripe.svg" alt="" width={48} height={30} />
        <span>Stripe Secure Payment</span>
      </p>
    </main>
  );
}

const card: React.CSSProperties = {
  maxWidth: 640,
  margin: "80px auto",
  padding: 32,
  background: "#fff7f4",
  color: "#642003",
  fontFamily: "var(--font-inter), Inter, sans-serif",
};

const actions: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  marginTop: 8,
};

const homeButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "12px 24px",
  borderRadius: 999,
  background: "#642003",
  color: "#fff",
  fontWeight: 600,
  textDecoration: "none",
};

const stripeMark: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 24,
  fontWeight: 600,
};
