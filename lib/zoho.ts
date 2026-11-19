export type MailResult =
  | { ok: true }
  | { ok: false; reason: "not-connected" }
  | { ok: false; reason: "rejected"; httpStatus: number; errorCode: string };

export const MAIL_FROM = { address: "bonjour@transportinparis.com", name: "Transport in Paris" };

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

export async function sendTransactionalEmail(input: {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  clientReference: string;
}, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  const config = zohoConfig();
  const to = input.to.trim();
  if (!config) return { ok: false, reason: "not-connected" };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, reason: "rejected", httpStatus: 0, errorCode: "no-recipient" };
  const body = {
    from: MAIL_FROM,
    to: [{ email_address: { address: to, name: input.toName.trim() || to } }],
    reply_to: [{ address: MAIL_FROM.address, name: MAIL_FROM.name }],
    subject: input.subject.slice(0, 180),
    textbody: input.text,
    htmlbody: input.html,
    client_reference: input.clientReference.slice(0, 100),
    track_clicks: false,
    track_opens: false,
  };
  let response: Response;
  try {
    response = await fetchImpl(`https://${config.host}/v1.1/email`, {
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
