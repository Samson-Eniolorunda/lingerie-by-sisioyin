import type { ContactMessage } from "@/schemas/contact";

/** Development message store. Stands in for the `contact_messages` table until the live schema is captured. */
const messages: (ContactMessage & { readonly receivedAt: string })[] = [];

export function storeMessage(message: ContactMessage, now = new Date()): number {
  messages.push({ ...message, receivedAt: now.toISOString() });
  return messages.length;
}

export function messageCount(): number {
  return messages.length;
}
