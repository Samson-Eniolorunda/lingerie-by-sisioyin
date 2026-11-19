import type { ContactMessage } from "@/schemas/contact";
import { SUBJECTS } from "@/schemas/contact";
import type { ContactRepository } from "@/server/data/contracts";
import { getDb, nextId } from "./db";

/** Development message store. Stands in for the contact messages table of the baseline schema. */
export const mockContact: ContactRepository = {
  async submit(message: ContactMessage, now = new Date()) {
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
    return { ok: true };
  },
};

export function messageCount(): number {
  return getDb().messages.length;
}
