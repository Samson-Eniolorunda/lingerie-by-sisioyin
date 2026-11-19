import { randomUUID } from "node:crypto";
import { normaliseNigerianPhone } from "@/lib/phone";
import type { AccountRepository } from "@/server/data/contracts";
import type { Address } from "@/types/account";
import { sessionClient } from "./clients";
import { supabaseAuth } from "./auth";
import { orderFromRow, profileFromRow } from "./mappers";
import { failResult, must, okResult, str, TRY_AGAIN, valueResult } from "./util";

const MAX_ADDRESSES = 5;
const MISSING = "Your account could not be found.";

type Row = Record<string, unknown>;

/** Every call here runs as the signed-in customer: row level security limits it to their own rows. */
async function me() {
  return sessionClient("customer");
}

async function ownRow(userId: string): Promise<Row | null> {
  const rows = must(await (await me()).from("profiles").select("*").eq("id", userId).limit(1));
  return rows[0] ?? null;
}

function addressesOf(row: Row): Address[] {
  return Array.isArray(row.saved_addresses) ? (row.saved_addresses as Address[]) : [];
}

async function storeAddresses(userId: string, list: Address[]) {
  const { error } = await (
    await me()
  )
    .from("profiles")
    .update({ saved_addresses: list })
    .eq("id", userId);
  return error;
}

export const supabaseAccount: AccountRepository = {
  async profile(userId) {
    const row = await ownRow(userId);
    return row ? profileFromRow(row) : null;
  },

  async updateProfile(userId, input) {
    const row = await ownRow(userId);
    if (!row) return failResult(MISSING);
    const settings = { ...((row.dashboard_settings as Row | null) ?? {}), gender: input.gender };
    const phone = input.phone === "" ? "" : (normaliseNigerianPhone(input.phone) ?? input.phone);
    const { data, error } = await (
      await me()
    )
      .from("profiles")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        full_name: `${input.firstName} ${input.lastName}`.trim(),
        phone,
        date_of_birth: input.dateOfBirth === "" ? null : input.dateOfBirth,
        dashboard_settings: settings,
      })
      .eq("id", userId)
      .select("*")
      .limit(1);
    const saved = data?.[0];
    if (error || !saved) return failResult(TRY_AGAIN);
    return valueResult(profileFromRow(saved));
  },

  async addresses(userId) {
    const row = await ownRow(userId);
    return row ? addressesOf(row) : [];
  },

  async saveAddress(userId, input, id) {
    const row = await ownRow(userId);
    if (!row) return failResult(MISSING);
    const current = addressesOf(row);
    const existing = id ? current.find((a) => a.id === id) : undefined;
    if (!existing && current.length >= MAX_ADDRESSES)
      return failResult(
        `You can keep up to ${MAX_ADDRESSES} addresses. Delete one to add another.`,
      );
    const isDefault = input.isDefault || current.length === 0;
    const saved: Address = {
      id: existing?.id ?? randomUUID(),
      label: input.label,
      recipient: input.recipient,
      phone: normaliseNigerianPhone(input.phone) ?? input.phone,
      line1: input.line1,
      city: input.city,
      state: input.state,
      isDefault,
    };
    const others = current
      .filter((a) => a.id !== saved.id)
      .map((a) => (isDefault ? { ...a, isDefault: false } : a));
    const next = [...others, saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    if (await storeAddresses(userId, next)) return failResult(TRY_AGAIN);
    return valueResult(saved);
  },

  async deleteAddress(userId, id) {
    const row = await ownRow(userId);
    if (!row) return failResult(MISSING);
    const current = addressesOf(row);
    const remaining = current.filter((a) => a.id !== id);
    if (remaining.length === current.length) return failResult("That address was already removed.");
    const next =
      remaining[0] && !remaining.some((a) => a.isDefault)
        ? remaining.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a))
        : remaining;
    if (await storeAddresses(userId, next)) return failResult(TRY_AGAIN);
    return okResult();
  },

  async orders(userId, query, page) {
    let request = (await me())
      .from("orders")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);
    if (query.status) request = request.eq("status", query.status);
    const { data, error, count } = await request;
    if (error) throw new Error(`Database read failed: ${error.message}`);
    return { items: (data ?? []).map(orderFromRow), total: count ?? 0 };
  },

  async order(userId, orderNumber) {
    const rows = must(
      await (
        await me()
      )
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .eq("order_number", orderNumber)
        .limit(1),
    );
    return rows[0] ? orderFromRow(rows[0]) : null;
  },

  async cancelOrder(_userId, orderNumber) {
    const { data, error } = await (
      await me()
    ).rpc("cancel_order", {
      p_order_number: orderNumber,
      p_reason: "Cancelled by the customer",
    });
    if (error) return failResult(TRY_AGAIN);
    const result = data as { ok: boolean; code?: string; message?: string };
    if (result.ok) return okResult();
    return failResult(
      result.code === "window_closed"
        ? "The 30-minute cancellation window has passed. Message us on WhatsApp and we will help."
        : (result.message ?? TRY_AGAIN),
    );
  },

  async requestDeletion(userId, password) {
    const row = await ownRow(userId);
    if (!row) return failResult(MISSING);
    if (str(row.role) !== "customer")
      return failResult("Staff accounts are removed by the owner, not from here.");
    if (!(await supabaseAuth.confirmPassword(str(row.email), password)))
      return failResult("That password is not correct.");
    const { error } = await (await me()).rpc("request_account_deletion", { p_withdraw: false });
    return error ? failResult(TRY_AGAIN) : okResult();
  },

  async withdrawDeletion() {
    const { error } = await (await me()).rpc("request_account_deletion", { p_withdraw: true });
    return error ? failResult(TRY_AGAIN) : okResult();
  },

  async exportData(userId) {
    const row = await ownRow(userId);
    if (!row) return "";
    const p = profileFromRow(row);
    const orders = must(
      await (
        await me()
      )
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ).map(orderFromRow);
    return [
      "Lingeries by Sisioyin: your data",
      "",
      "Profile",
      `Name: ${p.firstName} ${p.lastName}`,
      `Email: ${p.email}`,
      `Phone: ${p.phone || "not set"}`,
      `Date of birth: ${p.dateOfBirth || "not set"}`,
      `Joined: ${p.createdAt}`,
      "",
      "Addresses",
      ...addressesOf(row).map(
        (a) => `${a.label}: ${a.recipient}, ${a.line1}, ${a.city}, ${a.state}`,
      ),
      "",
      "Orders",
      ...orders.map(
        (o) => `${o.orderNumber} · ${o.createdAt.slice(0, 10)} · ${o.status} · NGN ${o.total}`,
      ),
    ].join("\n");
  },
};
