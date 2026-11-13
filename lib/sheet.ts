import { GoogleAuth, type JWTInput } from "google-auth-library";

const HEADERS = [
  "submitted_at", "quote_id", "service", "trip_type", "pickup", "dropoff", "date", "time", "return_date", "return_time",
  "passengers", "luggage", "vehicle", "flight", "notes", "price_usd", "price_status", "printemps_passes",
  "name", "email", "mobile", "contact_pref", "sms_opt_in", "payment_status",
] as const;

export type SheetRow = Record<(typeof HEADERS)[number], string>;

function sheetId(): string {
  return (process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || "").trim();
}

function credentials(): JWTInput | undefined {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_CREDENTIALS || "").trim();
  if (!raw) return undefined;
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as JWTInput;
  if (!parsed.client_email || !parsed.private_key) throw new Error("sheet-credentials");
  return parsed;
}

export function sheetConfigured(): boolean {
  if (!sheetId()) return false;
  try {
    if (credentials()) return true;
  } catch {
    return false;
  }
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ credentials: credentials(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("sheet-auth");
  return token.token;
}

async function sheetsFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("sheets request failed", response.status);
    throw new Error("sheet-request");
  }
  return response;
}

async function tabTitle(): Promise<string> {
  const response = await sheetsFetch("?fields=sheets.properties.title");
  const data = (await response.json()) as { sheets?: { properties?: { title?: string } }[] };
  const titles = (data.sheets || []).map((sheet) => sheet.properties?.title || "").filter(Boolean);
  return titles.find((title) => title === "Quotes") || titles[0] || "Quotes";
}

function range(title: string, cells: string): string {
  return `'${title.replace(/'/g, "''")}'!${cells}`;
}

async function headerRow(title: string): Promise<string[]> {
  const response = await sheetsFetch(`/values/${encodeURIComponent(range(title, "1:1"))}`);
  const data = (await response.json()) as { values?: string[][] };
  return (data.values?.[0] || []).map((cell) => String(cell || "").trim());
}

async function writeHeaders(title: string, headers: string[]): Promise<void> {
  await sheetsFetch(`/values/${encodeURIComponent(range(title, "1:1"))}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [headers] }),
  });
}

export async function appendUnpaidQuote(row: SheetRow): Promise<void> {
  if (!sheetConfigured()) throw new Error("sheet-not-configured");
  const title = await tabTitle();
  let headers = await headerRow(title);
  if (headers.length === 0) {
    headers = [...HEADERS];
    await writeHeaders(title, headers);
  } else {
    const missing = HEADERS.filter((name) => !headers.includes(name));
    if (missing.length) {
      headers = [...headers, ...missing];
      await writeHeaders(title, headers);
    }
  }
  const values = headers.map((name) => (name in row ? row[name as keyof SheetRow] : ""));
  await sheetsFetch(`/values/${encodeURIComponent(range(title, "A1"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [values] }),
  });
}

export async function markQuotePaid(quoteId: string): Promise<boolean> {
  if (!quoteId || !sheetConfigured()) return false;
  const title = await tabTitle();
  const response = await sheetsFetch(`/values/${encodeURIComponent(range(title, "A:Z"))}`);
  const data = (await response.json()) as { values?: string[][] };
  const rows = data.values || [];
  const headers = (rows[0] || []).map((cell) => String(cell || "").trim());
  const idCol = headers.indexOf("quote_id");
  let statusCol = headers.indexOf("payment_status");
  if (idCol < 0) return false;
  if (statusCol < 0) {
    statusCol = headers.length;
    await writeHeaders(title, [...headers, "payment_status"]);
  }
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[idCol] || "") === quoteId);
  if (rowIndex < 0) return false;
  let n = statusCol + 1;
  let column = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    column = String.fromCharCode(65 + rem) + column;
    n = Math.floor((n - 1) / 26);
  }
  await sheetsFetch(`/values/${encodeURIComponent(range(title, `${column}${rowIndex + 1}`))}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [["paid"]] }),
  });
  return true;
}
