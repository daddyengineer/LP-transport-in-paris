import assert from "node:assert/strict";
import test from "node:test";
import { testSecretKey } from "./quote";
import { checkoutReturnOrigin, createPaymentSession, readPaidSession } from "./stripe";

test("secret key accepts test and live account secrets only", () => {
  assert.equal(testSecretKey("sk_test_abc123"), "sk_test_abc123");
  assert.equal(testSecretKey("  sk_live_abc123  "), "sk_live_abc123");
  assert.equal(testSecretKey("pk_live_abc123"), null);
  assert.equal(testSecretKey("rk_live_abc123"), null);
  assert.equal(testSecretKey("sk_test_"), null);
  assert.equal(testSecretKey("sk_live_not a key"), null);
  assert.equal(testSecretKey(undefined), null);
});

test("return origin is limited to the production hosts", () => {
  assert.equal(checkoutReturnOrigin("www.transportinparis.com"), "https://www.transportinparis.com");
  assert.equal(checkoutReturnOrigin("TransportInParis.com:443"), "https://transportinparis.com");
  assert.equal(
    checkoutReturnOrigin("transport-in-paris-production.vercel.app, evil.example"),
    "https://transport-in-paris-production.vercel.app",
  );
  assert.equal(checkoutReturnOrigin("localhost:3000"), null);
  assert.equal(checkoutReturnOrigin("www.transportinparis.com.evil.example"), null);
  assert.equal(checkoutReturnOrigin("preview-transport-in-paris-production.vercel.app"), null);
});

test("checkout session ids accept test and live, and reject anything else", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "cs_live_abc123",
    payment_status: "paid",
    amount_total: 12000,
    currency: "usd",
    metadata: { quote_id: "q_abc" },
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const live = await readPaidSession("cs_live_abc123");
    assert.equal(live?.paid, true);
    assert.equal(live?.quoteId, "q_abc");
    assert.equal(live?.amountUsd, 120);
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    const testSession = await readPaidSession("cs_test_abc123");
    assert.equal(testSession?.paid, true);
    assert.equal(await readPaidSession("pi_test_abc123"), null);
    assert.equal(await readPaidSession("cs_live_"), null);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  }
});

test("hosted checkout is payment mode in USD and refuses other return hosts", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
  let calls = 0;
  let sent = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    sent = String(init?.body ?? "");
    return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_abc123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const url = await createPaymentSession({
      usd: 120,
      quoteId: "q_test",
      description: "CDG to Paris",
      email: "guest@example.com",
      successUrl: "https://www.transportinparis.com/quote/success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://www.transportinparis.com/#quote",
    });
    assert.equal(url, "https://checkout.stripe.com/c/pay/cs_test_abc123");
    assert.equal(calls, 1);
    assert.match(sent, /(?:^|&)mode=payment(?:&|$)/);
    assert.match(sent, /price_data%5D%5Bcurrency%5D=usd(?:&|$)/);
    assert.match(sent, /metadata%5Bquote_id%5D=q_test(?:&|$)/);
    await assert.rejects(
      () => createPaymentSession({
        usd: 120,
        quoteId: "q_test",
        description: "CDG to Paris",
        email: "guest@example.com",
        successUrl: "https://evil.example/quote/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://www.transportinparis.com/#quote",
      }),
      /return-url/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  }
});
