"use server";

import { contactMessageSchema } from "@/schemas/contact";
import { storeMessage } from "@/server/mock/messages";

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
  try {
    storeMessage(parsed.data);
  } catch {
    return {
      ok: false,
      message: "We could not save your message. Please try again, or message us on WhatsApp.",
      fieldErrors: {},
    };
  }
  return { ok: true };
}
