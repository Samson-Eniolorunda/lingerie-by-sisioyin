import { SUBJECTS } from "@/schemas/contact";
import type { ContactRepository } from "@/server/data/contracts";
import { anonClient } from "./clients";
import { failResult, okResult, TRY_AGAIN } from "./util";

export const supabaseContact: ContactRepository = {
  async submit(message) {
    const subject = SUBJECTS.find((s) => s.id === message.subject)?.label ?? "Other";
    const { data, error } = await anonClient().rpc("submit_contact_message", {
      p_name: message.name,
      p_email: message.email,
      p_phone: message.phone ?? "",
      p_subject: subject,
      p_order_number: message.orderNumber ?? "",
      p_body: message.message,
    });
    if (error) return failResult(TRY_AGAIN);
    const result = data as { ok: boolean; message?: string };
    return result.ok ? okResult() : failResult(result.message ?? TRY_AGAIN);
  },
};
