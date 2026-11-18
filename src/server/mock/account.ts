import { normaliseNigerianPhone } from "@/lib/phone";
import { canCancelByCustomer } from "@/lib/order-rules";
import type { AccountRepository } from "@/server/data/contracts";
import { verifyPassword, getDb, nextId, type UserRecord } from "./db";
import { restoreStock } from "./stock";
import type { StoredOrder } from "./orders";

const MAX_ADDRESSES = 5;

function user(id: string): UserRecord | undefined {
  return getDb().users.get(id);
}

function ordersFor(email: string): StoredOrder[] {
  return [...getDb().orders.values()]
    .filter((o) => o.email === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const mockAccount: AccountRepository = {
  async profile(userId) {
    return user(userId)?.profile ?? null;
  },

  async updateProfile(userId, input) {
    const record = user(userId);
    if (!record) return { ok: false, message: "Your account could not be found." };
    record.profile = {
      ...record.profile,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone === "" ? "" : (normaliseNigerianPhone(input.phone) ?? input.phone),
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
    };
    return { ok: true, value: record.profile };
  },

  async addresses(userId) {
    return user(userId)?.addresses ?? [];
  },

  async saveAddress(userId, input, id) {
    const record = user(userId);
    if (!record) return { ok: false, message: "Your account could not be found." };
    const phone = normaliseNigerianPhone(input.phone) ?? input.phone;
    const existing = id ? record.addresses.find((a) => a.id === id) : undefined;
    if (!existing && record.addresses.length >= MAX_ADDRESSES)
      return {
        ok: false,
        message: `You can keep up to ${MAX_ADDRESSES} addresses. Delete one to add another.`,
      };
    const isDefault = input.isDefault || record.addresses.length === 0;
    const saved = {
      id: existing?.id ?? nextId(getDb(), "addr"),
      label: input.label,
      recipient: input.recipient,
      phone,
      line1: input.line1,
      city: input.city,
      state: input.state,
      isDefault,
    };
    const others = record.addresses
      .filter((a) => a.id !== saved.id)
      .map((a) => (isDefault ? { ...a, isDefault: false } : a));
    record.addresses = [...others, saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return { ok: true, value: saved };
  },

  async deleteAddress(userId, id) {
    const record = user(userId);
    if (!record) return { ok: false, message: "Your account could not be found." };
    const remaining = record.addresses.filter((a) => a.id !== id);
    if (remaining.length === record.addresses.length)
      return { ok: false, message: "That address was already removed." };
    const first = remaining[0];
    record.addresses =
      first && !remaining.some((a) => a.isDefault)
        ? remaining.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a))
        : remaining;
    return { ok: true };
  },

  async orders(userId) {
    const record = user(userId);
    return record ? ordersFor(record.profile.email) : [];
  },

  async order(userId, orderNumber) {
    const record = user(userId);
    const order = getDb().orders.get(orderNumber);
    return record && order && order.email === record.profile.email ? order : null;
  },

  async cancelOrder(userId, orderNumber) {
    const record = user(userId);
    const db = getDb();
    const order = db.orders.get(orderNumber);
    if (!record || !order || order.email !== record.profile.email)
      return { ok: false, message: "We could not find that order." };
    if (!canCancelByCustomer(order, new Date()))
      return {
        ok: false,
        message:
          order.status === "pending"
            ? "The 30-minute cancellation window has passed. Message us on WhatsApp and we will help."
            : "This order is already being handled. Message us on WhatsApp and we will help.",
      };
    restoreStock(db, order);
    db.orders.set(order.orderNumber, {
      ...order,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  },

  async requestDeletion(userId, password) {
    const record = user(userId);
    if (!record) return { ok: false, message: "Your account could not be found." };
    if (!verifyPassword(password, record.passwordHash))
      return { ok: false, message: "That password is not correct." };
    if (record.role !== null)
      return { ok: false, message: "Staff accounts are removed by the owner, not from here." };
    record.profile = { ...record.profile, deletionRequestedAt: new Date().toISOString() };
    return { ok: true };
  },

  async withdrawDeletion(userId) {
    const record = user(userId);
    if (!record) return { ok: false, message: "Your account could not be found." };
    record.profile = { ...record.profile, deletionRequestedAt: null };
    return { ok: true };
  },

  async exportData(userId) {
    const record = user(userId);
    if (!record) return "";
    const p = record.profile;
    const lines = [
      "Lingerie by Sisioyin: your data",
      "",
      "Profile",
      `Name: ${p.firstName} ${p.lastName}`,
      `Email: ${p.email}`,
      `Phone: ${p.phone || "not set"}`,
      `Date of birth: ${p.dateOfBirth || "not set"}`,
      `Joined: ${p.createdAt}`,
      "",
      "Addresses",
      ...record.addresses.map(
        (a) => `${a.label}: ${a.recipient}, ${a.line1}, ${a.city}, ${a.state}`,
      ),
      "",
      "Orders",
      ...ordersFor(p.email).map(
        (o) => `${o.orderNumber} · ${o.createdAt.slice(0, 10)} · ${o.status} · NGN ${o.total}`,
      ),
    ];
    return lines.join("\n");
  },
};
