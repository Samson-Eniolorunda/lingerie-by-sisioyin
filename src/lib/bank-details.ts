import type { ContentNode } from "@/content/schema";
import type { BankDetails } from "@/types/account";

/** What every page says while the owner has not saved any bank details. */
export const PAYMENT_DETAILS_UPDATING = "Payment details are being updated";

/** One line for running text (terms, privacy): bank, number and name, or the "being updated" notice. */
export function bankSummary(bank: BankDetails | null): string {
  return bank
    ? `${bank.bankName}, Account Number: ${bank.accountNumber}, Account Name: ${bank.accountName}`
    : PAYMENT_DETAILS_UPDATING;
}

function fill(text: string, bank: BankDetails | null): string {
  const none = PAYMENT_DETAILS_UPDATING;
  return text
    .replaceAll("{{bank.summary}}", bankSummary(bank))
    .replaceAll("{{bank.name}}", bank?.bankName ?? none)
    .replaceAll("{{bank.number}}", bank?.accountNumber ?? none)
    .replaceAll("{{bank.accountName}}", bank?.accountName ?? none);
}

/** Replaces the `{{bank.*}}` markers in legal and FAQ text with what the owner saved. */
export function fillBankDetails(
  nodes: readonly ContentNode[],
  bank: BankDetails | null,
): ContentNode[] {
  return nodes.map((node) =>
    typeof node === "string" ? fill(node, bank) : { ...node, c: fillBankDetails(node.c, bank) },
  );
}
