import assert from "node:assert/strict";
import test from "node:test";
import { bookingMessage, cronAuthorized, deliverBookingNotices, paymentMessage, paymentOrderMerge, serviceDateTomorrow } from "./notices";
import { dueForReminder, type StoredQuote } from "./sheet";
import { sendTelegram } from "./telegram";
import { ORDER_CONFIRMATION_TEMPLATE_KEY, sendTemplateEmail, sendTransactionalEmail } from "./zoho";
import { priceQuote, validateQuote, type QuoteInput } from "./quote";

const ENV_KEYS = ["ZOHO_CPAAS_HOST", "ZOHO_CPAAS_AGENT_ALIAS", "ZOHO_CPAAS_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;

function saveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (saved[key] == null) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function sampleInput(): QuoteInput {
  return {
    service: "airport", tripType: "oneway", pickup: "CDG Airport", dropoff: "Paris hotel", date: "12/15/2026", time: "10:00 AM",
    returnDate: "", returnTime: "", passengers: 2, luggage: 1, vehicleId: "premium-van", flight: "", notes: "",
    name: "Notice Test", email: "guest@example.com", mobile: "2025550199", contactPref: "email", smsOptIn: false,
  };
}

function stored(patch: Partial<StoredQuote> = {}): StoredQuote {
  return {
    quoteId: "q_test", name: "Notice Test", email: "guest@example.com", service: "airport", pickup: "CDG", dropoff: "Paris",
    date: "11/20/2026", time: "10:00 AM", flight: "AF123", passengers: "2", luggage: "1", vehicle: "Premium Van", priceUsd: "170",
    paymentStatus: "paid", invoiceSent: "", paymentNoticeSent: "", reminderSent: "", ...patch,
  };
}

test("zoho sends the configured host and the key unchanged", async () => {
  const saved = saveEnv();
  const previousFetch = globalThis.fetch;
  process.env.ZOHO_CPAAS_HOST = "https://cpaas.zoho.com/ignored";
  process.env.ZOHO_CPAAS_AGENT_ALIAS = "agent-alias-test";
  process.env.ZOHO_CPAAS_API_KEY = "Zoho-enczapikey unit-test-value";
  let url = "";
  let auth = "";
  let body = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    auth = new Headers(init?.headers).get("authorization") || "";
    body = String(init?.body || "");
    return new Response(JSON.stringify({ data: [{ code: "EM_104", message: "OK" }], message: "OK" }), { status: 201 });
  }) as typeof fetch;
  try {
    const result = await sendTransactionalEmail({
      to: "guest@example.com", toName: "Guest", subject: "Hello", text: "Hello", html: "<p>Hello</p>", clientReference: "q_test",
    });
    assert.equal(result.ok, true);
    assert.equal(url, "https://cpaas.zoho.com/v1.1/email");
    assert.equal(auth, "Zoho-enczapikey unit-test-value");
    assert.match(body, /bonjour@transportinparis.com/);
    assert.doesNotMatch(body, /unit-test-value/);
    assert.doesNotMatch(auth, /unit-test-value unit/);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});

test("zoho reports the error code and does not send without the agent alias", async () => {
  const saved = saveEnv();
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ data: { error_code: "TM_3004", message: "Invalid request" }, message: "error" }), { status: 400 });
  }) as typeof fetch;
  try {
    process.env.ZOHO_CPAAS_HOST = "cpaas.zoho.com";
    process.env.ZOHO_CPAAS_AGENT_ALIAS = "agent-alias-test";
    process.env.ZOHO_CPAAS_API_KEY = "Zoho-enczapikey unit-test-value";
    const rejected = await sendTransactionalEmail({
      to: "guest@example.com", toName: "Guest", subject: "Hello", text: "Hello", html: "<p>Hello</p>", clientReference: "q_test",
    });
    assert.deepEqual(rejected, { ok: false, reason: "rejected", httpStatus: 400, errorCode: "TM_3004" });
    delete process.env.ZOHO_CPAAS_AGENT_ALIAS;
    const missing = await sendTransactionalEmail({
      to: "guest@example.com", toName: "Guest", subject: "Hello", text: "Hello", html: "<p>Hello</p>", clientReference: "q_test",
    });
    assert.deepEqual(missing, { ok: false, reason: "not-connected" });
    assert.equal(calls, 1);
    const blank = await sendTransactionalEmail({
      to: "", toName: "", subject: "Hello", text: "Hello", html: "<p>Hello</p>", clientReference: "q_test",
    });
    assert.equal(blank.ok, false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});

test("telegram posts to the chat and skips when the token is missing", async () => {
  const saved = saveEnv();
  const previousFetch = globalThis.fetch;
  let url = "";
  let body = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    body = String(init?.body || "");
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  }) as typeof fetch;
  try {
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAUnitTestTokenValue";
    process.env.TELEGRAM_CHAT_ID = "-1001234567890";
    const sent = await sendTelegram("New booking\nQuote: q_test");
    assert.equal(sent.ok, true);
    assert.equal(url, "https://api.telegram.org/bot123456789:AAUnitTestTokenValue/sendMessage");
    assert.match(body, /"chat_id":"-1001234567890"/);
    delete process.env.TELEGRAM_BOT_TOKEN;
    const missing = await sendTelegram("hello");
    assert.deepEqual(missing, { ok: false, reason: "not-connected" });
    process.env.TELEGRAM_BOT_TOKEN = "123456789:AAUnitTestTokenValue";
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error_code: 400, description: "hidden" }), { status: 400 })) as typeof fetch;
    const rejected = await sendTelegram("hello");
    assert.deepEqual(rejected, { ok: false, reason: "rejected", httpStatus: 400, errorCode: "400" });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});

test("order confirmation uses the existing template and quote fields", async () => {
  const saved = saveEnv();
  const previousFetch = globalThis.fetch;
  process.env.ZOHO_CPAAS_HOST = "https://cpaas.zoho.com/ignored";
  process.env.ZOHO_CPAAS_AGENT_ALIAS = "agent-alias-test";
  process.env.ZOHO_CPAAS_API_KEY = "Zoho-enczapikey unit-test-value";
  let url = "";
  let body = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    body = String(init?.body || "");
    return new Response(JSON.stringify({ data: [{ code: "EM_104", message: "OK" }], message: "OK" }), { status: 201 });
  }) as typeof fetch;
  try {
    const merge = paymentOrderMerge(stored(), "q_test", 170);
    assert.equal(merge["Booking ID"], "q_test");
    assert.equal(merge["First Name"], "Notice Test");
    assert.equal(merge.Service, "Airport");
    assert.equal(merge.Date, "11/20/2026");
    assert.equal(merge["Pickup Time"], "10:00 AM");
    assert.equal(merge["Pickup Address and Meeting Point"], "CDG");
    assert.equal(merge["Drop-off Address"], "Paris");
    assert.equal(merge["Flight Number"], "AF123");
    assert.equal(merge.Passengers, "2");
    assert.equal(merge.Luggage, "1");
    assert.equal(merge.Vehicle, "Premium Van");
    assert.equal(merge["Total Price"], "USD 170");
    assert.equal(merge["Payment Status"], "paid");
    assert.equal(merge["Company Legal Name"], "Travel Kif SAS");
    assert.equal(merge["Company Address"], "Based in Paris");
    assert.equal(merge["Cancellation Policy Link"], "https://www.transportinparis.com/#faq");
    assert.equal(merge["Privacy Policy URL"], "https://www.transportinparis.com/");
    assert.equal(merge["Manage Booking URL"], "https://www.transportinparis.com/#quote");
    assert.equal(merge["Unsubscribe URL"], "mailto:bonjour@transportinparis.com");
    assert.equal(paymentOrderMerge(stored({ priceUsd: "180", flight: "" }), "q_test", null)["Total Price"], "USD 180");
    assert.equal(paymentOrderMerge(stored({ flight: "" }), "q_test", 170)["Flight Number"], "");
    const result = await sendTemplateEmail({
      to: "guest@example.com",
      toName: "Notice Test",
      templateKey: ORDER_CONFIRMATION_TEMPLATE_KEY,
      mergeInfo: merge,
      clientReference: "q_test-order",
    });
    assert.equal(result.ok, true);
    assert.equal(url, "https://cpaas.zoho.com/v1.1/email/template/batch");
    const parsed = JSON.parse(body) as {
      template_key?: string;
      subject?: string;
      htmlbody?: string;
      textbody?: string;
      merge_info?: Record<string, string>;
      from?: { address?: string; name?: string };
      cc?: unknown;
      bcc?: unknown;
      to?: { email_address?: { address?: string }; merge_info?: Record<string, string> }[];
    };
    assert.equal(parsed.template_key, ORDER_CONFIRMATION_TEMPLATE_KEY);
    assert.equal(parsed.from?.address, "noreply@transportinparis.com");
    assert.equal(parsed.from?.name, "noreply");
    assert.equal(parsed.subject, undefined);
    assert.equal(parsed.htmlbody, undefined);
    assert.equal(parsed.textbody, undefined);
    assert.equal(parsed.merge_info, undefined);
    assert.equal(parsed.cc, undefined);
    assert.equal(parsed.bcc, undefined);
    assert.equal(parsed.to?.length, 1);
    assert.equal(parsed.to?.[0]?.email_address?.address, "guest@example.com");
    assert.equal(parsed.to?.[0]?.merge_info?.["Booking ID"], "q_test");
    assert.equal(parsed.to?.[0]?.merge_info?.["Total Price"], "USD 170");
    assert.equal(parsed.to?.[0]?.merge_info?.["Drop-off Address"], "Paris");
    assert.equal(parsed.to?.[0]?.merge_info?.["Pickup Address and Meeting Point"], "CDG");
    assert.doesNotMatch(body, /unit-test-value|Your Paris transfer invoice|accounts@info.zylker.com|manager@zylker.com/);
    delete process.env.ZOHO_CPAAS_AGENT_ALIAS;
    const missing = await sendTemplateEmail({
      to: "guest@example.com", toName: "Notice Test", templateKey: ORDER_CONFIRMATION_TEMPLATE_KEY, mergeInfo: merge, clientReference: "q_test-order",
    });
    assert.deepEqual(missing, { ok: false, reason: "not-connected" });
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});

test("booking and payment messages stay free of card data", () => {
  const validated = validateQuote(sampleInput());
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const text = bookingMessage(validated.quote, "q_abc");
  assert.match(text, /Notice Test/);
  assert.match(text, /CDG Airport to Paris hotel/);
  assert.match(text, /12\/15\/2026 10:00 AM/);
  assert.match(text, /q_abc/);
  assert.doesNotMatch(text, /2025550199|card|sk_/);
  assert.equal(paymentMessage("q_abc", 170), "Payment received\nQuote: q_abc\nAmount: USD 170");
  assert.equal(priceQuote(sampleInput()).status, "quoted");
});

test("a reminder is due only for a paid pickup on that date that was not sent", () => {
  assert.equal(dueForReminder(stored(), "11/20/2026"), true);
  assert.equal(dueForReminder(stored({ paymentStatus: "unpaid" }), "11/20/2026"), false);
  assert.equal(dueForReminder(stored({ reminderSent: "yes" }), "11/20/2026"), false);
  assert.equal(dueForReminder(stored({ date: "" }), "11/20/2026"), false);
  assert.equal(dueForReminder(stored({ date: "11/21/2026" }), "11/20/2026"), false);
});

test("tomorrow is the next calendar day in Paris", () => {
  assert.equal(serviceDateTomorrow(new Date("2026-11-19T12:00:00.000Z")), "11/20/2026");
  assert.equal(serviceDateTomorrow(new Date("2026-11-19T23:30:00.000Z")), "11/21/2026");
});

test("a failed Zoho or Telegram call does not reject the booking notice", async () => {
  const saved = saveEnv();
  const previousFetch = globalThis.fetch;
  process.env.ZOHO_CPAAS_HOST = "cpaas.zoho.com";
  process.env.ZOHO_CPAAS_AGENT_ALIAS = "agent-alias-test";
  process.env.ZOHO_CPAAS_API_KEY = "Zoho-enczapikey unit-test-value";
  process.env.TELEGRAM_BOT_TOKEN = "123456789:AAUnitTestTokenValue";
  process.env.TELEGRAM_CHAT_ID = "12345";
  globalThis.fetch = (async () => {
    throw new Error("down");
  }) as typeof fetch;
  const validated = validateQuote(sampleInput());
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  try {
    await deliverBookingNotices(validated.quote, "q_test");
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});

test("cron authorization requires the bearer secret", () => {
  assert.equal(cronAuthorized(null, "secret-value"), false);
  assert.equal(cronAuthorized("Bearer secret-value", ""), false);
  assert.equal(cronAuthorized("Bearer secret-value", "secret-value"), true);
  assert.equal(cronAuthorized("Bearer other-value", "secret-value"), false);
  assert.equal(cronAuthorized("secret-value", "secret-value"), false);
});
