"use server";

import { contactMessageSchema } from "@/schemas/contact";
import { clientIp } from "@/server/auth/request";
import { data } from "@/server/data";
import { allowRequest } from "@/server/rate-limit";

export type ContactState =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly fieldErrors: Record<string, string> };

/** Reports success only after the message is stored (BUG-11); otherwise the form says so and offers WhatsApp. */
export async function sendContact(input: unknown): Promise<ContactState> {
  const parsed = contactMessageSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please check the highlighted details.", fieldErrors };
  }
  if (
    !(await allowRequest("contact", await clientIp(), [parsed.data.email], {
      ip: 10,
      subject: 5,
      windowMs: 3_600_000,
    }))
  )
    return {
      ok: false,
      message:
        "Too many messages from this connection. Please wait a little, or message us on WhatsApp.",
      fieldErrors: {},
    };
  try {
    const result = await data.contact.submit(parsed.data);
    if (!result.ok) throw new Error(result.message);
  } catch {
    return {
      ok: false,
      message: "We could not save your message. Please try again, or message us on WhatsApp.",
      fieldErrors: {},
    };
  }
  return { ok: true };
}
