export const VEHICLES = [
  { id: "premium-van", name: "Premium Van", pax: 7, bags: 7, fromPrice: 170 },
  { id: "vip-van", name: "VIP Van", pax: 8, bags: 8, fromPrice: 180 },
  { id: "economy-van", name: "Economy Van", pax: 7, bags: 6, fromPrice: 150 },
  { id: "compact-suv", name: "Compact SUV", pax: 3, bags: 4, fromPrice: 120 },
  { id: "big-van", name: "Big Van", pax: 16, bags: 12, fromPrice: 280 },
  { id: "luxury-sedan", name: "Luxury Sedan", pax: 3, bags: 3, fromPrice: 350 },
] as const;

export type Vehicle = (typeof VEHICLES)[number];

const PLACES: { id: string; patterns: RegExp[] }[] = [
  { id: "cdg", patterns: [/charles de gaulle/i, /\bcdg\b/i, /\broissy\b/i] },
  { id: "ory", patterns: [/\borly\b/i, /\bory\b/i] },
  { id: "bva", patterns: [/\bbeauvais\b/i, /\bbva\b/i] },
  { id: "disneyland", patterns: [/disneyland/i, /\bdisney\b/i] },
  { id: "versailles", patterns: [/versailles/i] },
  { id: "champagne", patterns: [/champagne/i, /\breims\b/i, /[eé]pernay/i] },
  { id: "gare", patterns: [/gare du nord/i, /nord station/i, /gare de lyon/i, /gare de l.?est/i] },
  { id: "paris", patterns: [/\bparis\b/i, /\bhotel\b/i, /\bairbnb\b/i, /le marais/i, /champs/i, /\blouvre\b/i, /city center/i, /city centre/i, /\bcenter\b/i, /\bcentre\b/i] },
];

const PAIR_BASE: Record<string, number> = {
  "bva|cdg": 190, "bva|champagne": 340, "bva|disneyland": 210, "bva|gare": 185, "bva|ory": 180, "bva|paris": 190, "bva|versailles": 220,
  "cdg|champagne": 320, "cdg|disneyland": 140, "cdg|gare": 110, "cdg|ory": 130, "cdg|paris": 120, "cdg|versailles": 150,
  "champagne|disneyland": 310, "champagne|gare": 290, "champagne|ory": 300, "champagne|paris": 280, "champagne|versailles": 300,
  "disneyland|gare": 115, "disneyland|ory": 120, "disneyland|paris": 110, "disneyland|versailles": 140,
  "gare|ory": 95, "gare|paris": 70, "gare|versailles": 100, "ory|paris": 100, "ory|versailles": 130, "paris|versailles": 95,
};

const EMAIL_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhaoo.com": "yahoo.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com", "icloud.co": "icloud.com", "icoud.com": "icloud.com", "aol.co": "aol.com", "protonmai.com": "protonmail.com",
};

const TIMES = (() => {
  const out: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const suffix = hour < 12 ? "AM" : "PM";
      const display = hour % 12 === 0 ? 12 : hour % 12;
      out.push(`${display}:${minute.toString().padStart(2, "0")} ${suffix}`);
    }
  }
  return new Set(out);
})();

const SERVICES = new Set(["airport", "private", "hourly"]);
const TRIPS = new Set(["oneway", "return"]);
const CONTACTS = new Set(["text", "email", "whatsapp"]);

export type PriceQuote = { status: "quoted"; usd: number; legUsd: number } | { status: "confirm"; usd: null; legUsd: null };

export function placeId(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  for (const place of PLACES) if (place.patterns.some((pattern) => pattern.test(text))) return place.id;
  return null;
}

export function vehicleById(id: string): Vehicle | undefined {
  return VEHICLES.find((vehicle) => vehicle.id === id);
}

export function priceQuote(input: { pickup: string; dropoff: string; tripType: string; vehicleId: string }): PriceQuote {
  const from = placeId(input.pickup);
  const to = placeId(input.dropoff);
  const vehicle = vehicleById(input.vehicleId);
  if (!from || !to || from === to || !vehicle) return { status: "confirm", usd: null, legUsd: null };
  const base = PAIR_BASE[[from, to].sort().join("|")];
  if (base == null) return { status: "confirm", usd: null, legUsd: null };
  const legUsd = Math.round((base * vehicle.fromPrice) / 120);
  return { status: "quoted", usd: legUsd * (input.tripType === "return" ? 2 : 1), legUsd };
}

export function usdCents(usd: number): number {
  return Math.round(usd * 100);
}

function dateOk(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function suggestion(passengers: number, luggage: number, currentId: string): Vehicle | undefined {
  const fits = VEHICLES.filter((vehicle) => vehicle.id !== currentId && vehicle.pax >= passengers && vehicle.bags >= luggage).sort((a, b) => a.fromPrice - b.fromPrice);
  return fits[0] || [...VEHICLES].filter((vehicle) => vehicle.pax >= passengers).sort((a, b) => b.bags - a.bags || a.fromPrice - b.fromPrice)[0];
}

export type QuoteInput = {
  service: string; tripType: string; pickup: string; dropoff: string; date: string; time: string;
  returnDate: string; returnTime: string; passengers: number; luggage: number; vehicleId: string;
  flight: string; notes: string; name: string; email: string; mobile: string; contactPref: string; smsOptIn: boolean;
};

export type ValidQuote = QuoteInput & { vehicle: Vehicle; price: PriceQuote; mobile: string; printempsPasses: number };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readQuoteBody(body: unknown): QuoteInput | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const passengers = Number(raw.passengers);
  const luggage = Number(raw.luggage);
  return {
    service: text(raw.service, 20), tripType: text(raw.tripType, 20), pickup: text(raw.pickup, 160), dropoff: text(raw.dropoff, 160),
    date: text(raw.date, 20), time: text(raw.time, 20), returnDate: text(raw.returnDate, 20), returnTime: text(raw.returnTime, 20),
    passengers: Number.isFinite(passengers) ? passengers : NaN, luggage: Number.isFinite(luggage) ? luggage : NaN,
    vehicleId: text(raw.vehicleId, 40), flight: text(raw.flight, 40), notes: text(raw.notes, 2000),
    name: text(raw.name, 120), email: text(raw.email, 160), mobile: text(raw.mobile, 40), contactPref: text(raw.contactPref, 20),
    smsOptIn: raw.smsOptIn === true,
  };
}

export function validateQuote(input: QuoteInput): { ok: true; quote: ValidQuote } | { ok: false; message: string } {
  if (!SERVICES.has(input.service)) return { ok: false, message: "Choose Airport, Private trip, or Hourly." };
  if (!TRIPS.has(input.tripType)) return { ok: false, message: "Choose one way or return." };
  const vehicle = vehicleById(input.vehicleId);
  if (!vehicle) return { ok: false, message: "Choose a vehicle." };
  if (!input.pickup || !input.dropoff) return { ok: false, message: "Enter a pickup and a drop-off." };
  if (!dateOk(input.date)) return { ok: false, message: "Use a date as MM/DD/YYYY." };
  if (!TIMES.has(input.time)) return { ok: false, message: "Choose a time in 15-minute steps." };
  if (input.tripType === "return") {
    if (!dateOk(input.returnDate)) return { ok: false, message: "Use a return date as MM/DD/YYYY." };
    if (!TIMES.has(input.returnTime)) return { ok: false, message: "Choose a return time in 15-minute steps." };
  }
  if (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > 16 || !Number.isInteger(input.luggage) || input.luggage < 0 || input.luggage > 16) {
    return { ok: false, message: "Passengers must be 1–16 and luggage 0–16." };
  }
  if (input.name.length < 2) return { ok: false, message: "Enter your full name." };
  if (!input.email) return { ok: false, message: "Enter your email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { ok: false, message: "Enter a full email, e.g. name@example.com" };
  const domain = input.email.split("@")[1]?.toLowerCase() ?? "";
  const meant = EMAIL_TYPOS[domain];
  if (meant) return { ok: false, message: `Did you mean ${input.email.split("@")[0]}@${meant}?` };
  const digits = phoneDigits(input.mobile);
  if (digits.length !== 10) return { ok: false, message: digits.length > 10 ? "Too long: +1 numbers have 10 digits" : "Too short: +1 numbers have 10 digits" };
  if (vehicle.pax < input.passengers || vehicle.bags < input.luggage) {
    const next = suggestion(input.passengers, input.luggage, vehicle.id);
    return { ok: false, message: `${vehicle.name} does not fit ${input.passengers} passengers and ${input.luggage} bags. ${next ? `${next.name} does.` : "Choose another vehicle."}` };
  }
  if (!CONTACTS.has(input.contactPref)) return { ok: false, message: "Choose how we should contact you." };
  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return { ok: true, quote: { ...input, vehicle, mobile: formatted, printempsPasses: input.passengers, price: priceQuote(input) } };
}

export function testSecretKey(value: string | undefined): string | null {
  const key = value?.trim() ?? "";
  return /^sk_(?:test|live)_[A-Za-z0-9]+$/.test(key) ? key : null;
}
