import { GoogleAuth, type JWTInput } from "google-auth-library";

const HEADERS = [
  "submitted_at", "quote_id", "service", "trip_type", "pickup", "dropoff", "date", "time", "return_date", "return_time",
  "passengers", "luggage", "vehicle", "flight", "notes", "price_usd", "price_status", "printemps_passes",
  "name", "email", "mobile", "contact_pref", "sms_opt_in", "payment_status",
] as const;

const NOTICE_COLUMNS = ["invoice_sent", "payment_notice_sent", "reminder_sent"] as const;

export type NoticeColumn = (typeof NOTICE_COLUMNS)[number];

const SHEET_HEADERS = [...HEADERS, ...NOTICE_COLUMNS];

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

function columnLetters(index: number): string {
  let n = index + 1;
  let column = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    column = String.fromCharCode(65 + rem) + column;
    n = Math.floor((n - 1) / 26);
  }
  return column;
}

type SheetTable = { title: string; headers: string[]; rows: string[][] };

async function readTable(): Promise<SheetTable> {
  const title = await tabTitle();
  const response = await sheetsFetch(`/values/${encodeURIComponent(range(title, "A:AZ"))}`);
  const data = (await response.json()) as { values?: string[][] };
  const rows = data.values || [];
  const headers = (rows[0] || []).map((cell) => String(cell || "").trim());
  return { title, headers, rows };
}

function cell(row: string[] | undefined, headers: string[], name: string): string {
  const index = headers.indexOf(name);
  if (!row || index < 0) return "";
  return String(row[index] || "").trim();
}

async function ensureHeader(table: SheetTable, name: string): Promise<number> {
  const existing = table.headers.indexOf(name);
  if (existing >= 0) return existing;
  table.headers = [...table.headers, name];
  await writeHeaders(table.title, table.headers);
  return table.headers.length - 1;
}

async function writeCell(table: SheetTable, rowIndex: number, columnIndex: number, value: string): Promise<void> {
  await sheetsFetch(`/values/${encodeURIComponent(range(table.title, `${columnLetters(columnIndex)}${rowIndex + 1}`))}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [[value]] }),
  });
}

export type StoredQuote = {
  quoteId: string;
  name: string;
  email: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  passengers: string;
  vehicle: string;
  priceUsd: string;
  paymentStatus: string;
  invoiceSent: string;
  paymentNoticeSent: string;
  reminderSent: string;
};

function storedQuote(headers: string[], row: string[]): StoredQuote | null {
  const quoteId = cell(row, headers, "quote_id");
  if (!quoteId) return null;
  return {
    quoteId,
    name: cell(row, headers, "name"),
    email: cell(row, headers, "email"),
    pickup: cell(row, headers, "pickup"),
    dropoff: cell(row, headers, "dropoff"),
    date: cell(row, headers, "date"),
    time: cell(row, headers, "time"),
    passengers: cell(row, headers, "passengers"),
    vehicle: cell(row, headers, "vehicle"),
    priceUsd: cell(row, headers, "price_usd"),
    paymentStatus: cell(row, headers, "payment_status"),
    invoiceSent: cell(row, headers, "invoice_sent"),
    paymentNoticeSent: cell(row, headers, "payment_notice_sent"),
    reminderSent: cell(row, headers, "reminder_sent"),
  };
}

export function dueForReminder(quote: StoredQuote, serviceDate: string): boolean {
  return quote.paymentStatus === "paid" && quote.reminderSent !== "yes" && quote.date.length > 0 && quote.date === serviceDate;
}

export async function appendUnpaidQuote(row: SheetRow): Promise<void> {
  if (!sheetConfigured()) throw new Error("sheet-not-configured");
  const title = await tabTitle();
  let headers = await headerRow(title);
  if (headers.length === 0) {
    headers = [...SHEET_HEADERS];
    await writeHeaders(title, headers);
  } else {
    const missing = SHEET_HEADERS.filter((name) => !headers.includes(name));
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
  const table = await readTable();
  if (table.headers.indexOf("quote_id") < 0) return false;
  const rowIndex = table.rows.findIndex((row, index) => index > 0 && cell(row, table.headers, "quote_id") === quoteId);
  if (rowIndex < 0) return false;
  const statusCol = await ensureHeader(table, "payment_status");
  await writeCell(table, rowIndex, statusCol, "paid");
  return true;
}

export async function readStoredQuote(quoteId: string): Promise<StoredQuote | null> {
  if (!quoteId || !sheetConfigured()) return null;
  const table = await readTable();
  for (let index = 1; index < table.rows.length; index += 1) {
    const quote = storedQuote(table.headers, table.rows[index] || []);
    if (quote?.quoteId === quoteId) return quote;
  }
  return null;
}

export async function setQuoteNotice(quoteId: string, column: NoticeColumn, value: string): Promise<boolean> {
  if (!quoteId || !sheetConfigured()) return false;
  const table = await readTable();
  const rowIndex = table.rows.findIndex((row, index) => index > 0 && cell(row, table.headers, "quote_id") === quoteId);
  if (rowIndex < 0) return false;
  const columnIndex = await ensureHeader(table, column);
  await writeCell(table, rowIndex, columnIndex, value);
  return true;
}

export async function listReminderQuotes(serviceDate: string): Promise<StoredQuote[]> {
  if (!serviceDate || !sheetConfigured()) return [];
  const table = await readTable();
  const due: StoredQuote[] = [];
  for (let index = 1; index < table.rows.length; index += 1) {
    const quote = storedQuote(table.headers, table.rows[index] || []);
    if (quote && dueForReminder(quote, serviceDate)) due.push(quote);
  }
  return due;
}
