import "@/lib/zod-config";
import { z } from "zod";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { normaliseNigerianPhone } from "@/lib/phone";

export const SUBJECTS = [
  { id: "order", label: "Order enquiry" },
  { id: "product", label: "Product question" },
  { id: "sizing", label: "Sizing help" },
  { id: "returns", label: "Returns and exchanges" },
  { id: "wholesale", label: "Wholesale enquiry" },
  { id: "other", label: "Other" },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export function isSubject(value: string | undefined): value is SubjectId {
  return SUBJECTS.some((s) => s.id === value);
}

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.email("Enter a valid email address, for example name@example.com.").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine(
      (v) => !v || normaliseNigerianPhone(v) !== null,
      "Enter a Nigerian number, such as 08012345678, or leave this blank.",
    ),
  subject: z.enum(["order", "product", "sizing", "returns", "wholesale", "other"], {
    error: "Choose what your message is about.",
  }),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine(
      (v) => !v || ORDER_NUMBER_PATTERN.test(v),
      "Order numbers look like LBS-18112026-0001.",
    ),
  message: z
    .string()
    .trim()
    .min(10, "Write at least a sentence so we can help.")
    .max(2000, "Messages can be up to 2,000 characters."),
});

export type ContactMessage = z.infer<typeof contactMessageSchema>;
