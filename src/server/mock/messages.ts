import type { ContactMessage } from "@/schemas/contact";
import { SUBJECTS } from "@/schemas/contact";
import { getDb, nextId } from "./db";

/** Development message store. Stands in for the `contact_messages` table until the live schema is captured. */
export function storeMessage(message: ContactMessage, now = new Date()): number {
  const db = getDb();
  const subject = SUBJECTS.find((s) => s.id === message.subject)?.label ?? "Other";
  db.messages.unshift({
    id: nextId(db, "msg"),
    name: message.name,
    email: message.email,
    phone: message.phone ?? "",
    subject,
    orderNumber: message.orderNumber ?? "",
    body: message.message,
    status: "unread",
    receivedAt: now.toISOString(),
    replies: [],
  });
  return db.messages.length;
}

export function messageCount(): number {
  return getDb().messages.length;
}
