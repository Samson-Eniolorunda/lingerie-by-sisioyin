import { DATA_MODE } from "@/config/data-mode";

/** One message, ready to send. `html` is the designed version; `text` is the plain fallback. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly replyTo?: string;
}

export type SendResult =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly reason: string };

export interface EmailTransport {
  send(message: EmailMessage): Promise<SendResult>;
}

declare global {
  var __lbsOutbox: (EmailMessage & { readonly at: string })[] | undefined;
}

/** What the in-memory transport "sent": read by tests and the development screens. */
export function outbox(): (EmailMessage & { readonly at: string })[] {
  globalThis.__lbsOutbox ??= [];
  return globalThis.__lbsOutbox;
}

export function clearOutbox(): void {
  outbox().length = 0;
}

/** Keeps messages in memory and contacts no service: development mode, tests, and previews with no key. */
export const memoryTransport: EmailTransport = {
  async send(message) {
    const box = outbox();
    if (box.length >= 200) box.shift();
    box.push({ ...message, at: new Date().toISOString() });
    return { ok: true, id: `memory-${box.length}` };
  },
};

/**
 * Resend, over its HTTP API (no SDK). Needs RESEND_API_KEY and a verified sending domain (see
 * OWNER_SETUP.md); the "from" address is EMAIL_FROM_ADDRESS.
 */
export function resendTransport(
  apiKey: string,
  from: string,
  fetcher: typeof fetch = fetch,
): EmailTransport {
  return {
    async send(message) {
      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });
        if (!response.ok) return { ok: false, reason: `Resend answered ${response.status}.` };
        const body = (await response.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: body.id ?? "unknown" };
      } catch {
        return { ok: false, reason: "Resend could not be reached." };
      }
    },
  };
}

/**
 * The transport for this process. With RESEND_API_KEY and EMAIL_FROM_ADDRESS set it is Resend; a
 * development or demonstration run (mock data) keeps messages in memory; a live shop with no key
 * sends nothing and says so (the order is never held back by an e-mail problem).
 */
export function transport(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EmailTransport {
  if (env.RESEND_API_KEY && env.EMAIL_FROM_ADDRESS)
    return resendTransport(env.RESEND_API_KEY, env.EMAIL_FROM_ADDRESS);
  if (DATA_MODE === "mock") return memoryTransport;
  return {
    async send() {
      return {
        ok: false,
        reason: "E-mail is not configured (RESEND_API_KEY, EMAIL_FROM_ADDRESS).",
      };
    },
  };
}
