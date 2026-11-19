export type MailResult =
  | { ok: true }
  | { ok: false; reason: "not-connected" }
  | { ok: false; reason: "rejected"; httpStatus: number; errorCode: string };

export const MAIL_FROM = { address: "bonjour@transportinparis.com", name: "Transport in Paris" };
export const ORDER_FROM = { address: "noreply@transportinparis.com", name: "noreply" };

type ZohoConfig = { host: string; authorization: string };

function hostName(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

// The send-mail token is already scoped to one CPaaS agent. The documented
// send URL is https://{host}/v1.1/email and the Authorization value is the
// token itself, prefix included. The agent alias must be configured so a
// half-set account does not send, but it is not a path parameter on this call.
export function zohoConfig(env: NodeJS.ProcessEnv = process.env): ZohoConfig | null {
  const host = hostName(env.ZOHO_CPAAS_HOST || "");
  const alias = (env.ZOHO_CPAAS_AGENT_ALIAS || "").trim();
  const authorization = (env.ZOHO_CPAAS_API_KEY || "").trim();
  if (!host || !alias || !authorization) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;
  if (/\s/.test(alias)) return null;
  if (!authorization.startsWith("Zoho-enczapikey ") || authorization.length <= "Zoho-enczapikey ".length) return null;
  return { host, authorization };
}

function errorCode(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "rejected";
  const record = payload as { data?: { error_code?: unknown }; error?: { code?: unknown }; error_code?: unknown };
  const raw = record.data?.error_code || record.error?.code || record.error_code;
  const code = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : "rejected";
}

// Existing Order Confirmation template. Do not create another one.
export const ORDER_CONFIRMATION_TEMPLATE_KEY =
  "2d6f.6e30e232a65ea59b.k1.f51d2000-e3d2-11f1-80e0-5254009dfd0a.1a1f2189e00";

function recipient(to: string, toName: string): { address: string; name: string } | null {
  const address = to.trim();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;
  return { address, name: toName.trim() || address };
}

async function postMail(path: "/v1.1/email" | "/v1.1/email/template/batch", body: unknown, fetchImpl: typeof fetch): Promise<MailResult> {
  const config = zohoConfig();
  if (!config) return { ok: false, reason: "not-connected" };
  let response: Response;
  try {
    response = await fetchImpl(`https://${config.host}${path}`, {
      method: "POST",
      headers: {
        Authorization: config.authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "network" };
  }
  if (response.ok) return { ok: true };
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { ok: false, reason: "rejected", httpStatus: response.status, errorCode: errorCode(payload) };
}

export async function sendTransactionalEmail(input: {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  clientReference: string;
}, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  const to = recipient(input.to, input.toName);
  if (!zohoConfig()) return { ok: false, reason: "not-connected" };
  if (!to) return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "no-recipient" };
  return postMail("/v1.1/email", {
    from: MAIL_FROM,
    to: [{ email_address: to }],
    reply_to: [{ address: MAIL_FROM.address, name: MAIL_FROM.name }],
    subject: input.subject.slice(0, 180),
    textbody: input.text,
    htmlbody: input.html,
    client_reference: input.clientReference.slice(0, 100),
    track_clicks: false,
    track_opens: false,
  }, fetchImpl);
}

export async function sendTemplateEmail(input: {
  to: string;
  toName: string;
  templateKey: string;
  mergeInfo: Record<string, string>;
  clientReference: string;
}, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  const to = recipient(input.to, input.toName);
  const templateKey = input.templateKey.trim();
  if (!zohoConfig()) return { ok: false, reason: "not-connected" };
  if (!to) return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "no-recipient" };
  if (!templateKey || /\s/.test(templateKey)) return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "no-template" };
  const mergeInfo: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.mergeInfo)) {
    if (!/^[A-Za-z0-9_ -]{1,60}$/.test(key)) continue;
    mergeInfo[key] = value.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  }
  return postMail("/v1.1/email/template/batch", {
    template_key: templateKey,
    from: ORDER_FROM,
    to: [{ email_address: to, merge_info: mergeInfo }],
    reply_to: [{ address: MAIL_FROM.address, name: MAIL_FROM.name }],
    client_reference: input.clientReference.slice(0, 100),
    track_clicks: false,
    track_opens: false,
  }, fetchImpl);
}
