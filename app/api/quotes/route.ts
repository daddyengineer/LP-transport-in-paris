import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { deliverBookingNotices } from "@/lib/notices";
import { readQuoteBody, validateQuote, type ValidQuote } from "@/lib/quote";
import { appendUnpaidQuote, type SheetRow } from "@/lib/sheet";
import { checkoutConnected, checkoutReturnOrigin, createPaymentSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function rowFor(quote: ValidQuote, quoteId: string): SheetRow {
  return {
    submitted_at: new Date().toISOString(),
    quote_id: quoteId,
    service: quote.service,
    trip_type: quote.tripType,
    pickup: quote.pickup,
    dropoff: quote.dropoff,
    date: quote.date,
    time: quote.time,
    return_date: quote.tripType === "return" ? quote.returnDate : "",
    return_time: quote.tripType === "return" ? quote.returnTime : "",
    passengers: String(quote.passengers),
    luggage: String(quote.luggage),
    vehicle: quote.vehicle.name,
    flight: quote.flight,
    notes: quote.notes,
    price_usd: quote.price.usd == null ? "" : String(quote.price.usd),
    price_status: quote.price.status,
    printemps_passes: String(quote.printempsPasses),
    name: quote.name,
    email: quote.email,
    mobile: quote.mobile,
    contact_pref: quote.contactPref,
    sms_opt_in: quote.smsOptIn ? "yes" : "no",
    payment_status: "unpaid",
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, saved: false, message: "The quote could not be saved." }, { status: 400 });
  }
  const input = readQuoteBody(body);
  if (!input) return NextResponse.json({ ok: false, saved: false, message: "The quote could not be saved." }, { status: 400 });
  const validated = validateQuote(input);
  if (!validated.ok) return NextResponse.json({ ok: false, saved: false, message: validated.message }, { status: 400 });

  const quoteId = `q_${randomBytes(8).toString("hex")}`;
  try {
    await appendUnpaidQuote(rowFor(validated.quote, quoteId));
  } catch (error) {
    console.error("quote row was not written", error instanceof Error ? error.message : "sheet");
    const checkout = checkoutConnected() ? "" : " Checkout is not connected. No card was charged.";
    return NextResponse.json({ ok: false, saved: false, message: `This quote was not saved to the Google Sheet.${checkout}` }, { status: 503 });
  }

  try {
    await deliverBookingNotices(validated.quote, quoteId);
  } catch {
    console.error("booking notices were not sent");
  }

  const price = validated.quote.price;
  if (price.status !== "quoted" || price.usd == null) {
    return NextResponse.json({ ok: true, saved: true, quoteId, message: "Your request was saved. We'll confirm this route. No card was charged." });
  }
  if (!checkoutConnected()) {
    return NextResponse.json({ ok: true, saved: true, quoteId, message: "Checkout is not connected. The quote was saved and no card was charged." });
  }
  const site = checkoutReturnOrigin(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  if (!site) {
    return NextResponse.json({ ok: true, saved: true, quoteId, message: "Checkout could not be started. No card was charged." });
  }
  try {
    const url = await createPaymentSession({
      usd: price.usd,
      quoteId,
      email: validated.quote.email,
      description: `${validated.quote.pickup} to ${validated.quote.dropoff}`,
      successUrl: `${site}/quote/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${site}/#quote`,
    });
    return NextResponse.json({ ok: true, saved: true, quoteId, url });
  } catch (error) {
    console.error("checkout session was not created", error instanceof Error ? error.message : "stripe");
    return NextResponse.json({ ok: true, saved: true, quoteId, message: "Checkout could not be started. No card was charged." });
  }
}
