export type TelegramResult =
  | { ok: true }
  | { ok: false; reason: "not-connected" }
  | { ok: false; reason: "rejected"; httpStatus: number; errorCode: string };

type TelegramConfig = { token: string; chatId: string };

export function telegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = (env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId || /\s/.test(token)) return null;
  if (!/^-?\d+$/.test(chatId)) return null;
  return { token, chatId };
}

export async function sendTelegram(text: string, fetchImpl: typeof fetch = fetch): Promise<TelegramResult> {
  const config = telegramConfig();
  if (!config) return { ok: false, reason: "not-connected" };
  const message = text.trim().slice(0, 3500);
  if (!message) return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "empty" };
  let response: Response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text: message }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "network" };
  }
  let payload: { ok?: boolean; error_code?: number } = {};
  try {
    payload = (await response.json()) as { ok?: boolean; error_code?: number };
  } catch {
    payload = {};
  }
  if (response.ok && payload.ok === true) return { ok: true };
  const code = typeof payload.error_code === "number" ? String(payload.error_code) : "rejected";
  return { ok: false, reason: "rejected", httpStatus: response.status, errorCode: /^[0-9]{1,6}$/.test(code) ? code : "rejected" };
}
