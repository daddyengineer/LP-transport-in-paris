import { testSecretKey, usdCents } from "@/lib/quote";

export type PaidSession = { id: string; paid: boolean; amountUsd: number | null; quoteId: string };

const CHECKOUT_RETURN_HOSTS = new Set([
  "www.transportinparis.com",
  "transportinparis.com",
  "transport-in-paris-production.vercel.app",
]);

function secret(): string | null {
  return testSecretKey(process.env.STRIPE_SECRET_KEY);
}

export function checkoutReturnOrigin(hostHeader: string | null | undefined): string | null {
  const first = (hostHeader ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first || /[/@\s]/.test(first)) return null;
  const host = first.replace(/:\d+$/, "");
  if (!CHECKOUT_RETURN_HOSTS.has(host)) return null;
  return `https://${host}`;
}

function allowedReturnUrl(value: string, kind: "success" | "cancel"): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (!CHECKOUT_RETURN_HOSTS.has(url.hostname)) return false;
  if (kind === "success") {
    return url.pathname === "/quote/success" && url.searchParams.get("session_id") === "{CHECKOUT_SESSION_ID}";
  }
  return url.pathname === "/" && url.hash === "#quote" && url.search === "";
}

export function checkoutConnected(): boolean {
  return secret() !== null;
}

export async function createPaymentSession(input: {
  usd: number; quoteId: string; description: string; email: string; successUrl: string; cancelUrl: string;
}): Promise<string> {
  const key = secret();
  if (!key) throw new Error("checkout-not-connected");
  if (!allowedReturnUrl(input.successUrl, "success") || !allowedReturnUrl(input.cancelUrl, "cancel")) {
    throw new Error("return-url");
  }
  const cents = usdCents(input.usd);
  if (!Number.isInteger(cents) || cents < 50) throw new Error("no-amount");
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email,
    client_reference_id: input.quoteId,
    "metadata[quote_id]": input.quoteId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": "Paris private transfer",
    "line_items[0][price_data][product_data][description]": input.description.slice(0, 500),
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    console.error("stripe checkout failed", response.status);
    throw new Error("stripe-session");
  }
  const session = (await response.json()) as { url?: string };
  if (!session.url || !session.url.startsWith("https://checkout.stripe.com/")) throw new Error("stripe-session");
  return session.url;
}

export async function readPaidSession(sessionId: string): Promise<PaidSession | null> {
  if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) return null;
  const key = secret();
  if (!key) return null;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("stripe session read failed", response.status);
    return null;
  }
  const session = (await response.json()) as {
    id?: string; payment_status?: string; amount_total?: number | null; currency?: string; metadata?: { quote_id?: string };
  };
  return {
    id: session.id || sessionId,
    paid: session.payment_status === "paid" && session.currency === "usd",
    amountUsd: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
    quoteId: session.metadata?.quote_id?.trim() || "",
  };
}
