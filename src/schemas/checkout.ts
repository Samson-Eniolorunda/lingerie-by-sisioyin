import { z } from "zod";
import { DELIVERY_STATES } from "@/lib/delivery";
import { normaliseNigerianPhone } from "@/lib/phone";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";

const stateIds = DELIVERY_STATES.map((s) => s.id) as [string, ...string[]];

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: z.email("Enter a valid email address, for example name@example.com.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .transform((value, ctx) => {
      const normalised = normaliseNigerianPhone(value);
      if (!normalised) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a Nigerian number, such as 08012345678 or +2348012345678.",
        });
        return z.NEVER;
      }
      return normalised;
    }),
});

export const deliverySchema = z.object({
  address: z.string().trim().min(5, "Enter your street address.").max(200),
  city: z.string().trim().min(2, "Enter your city or town.").max(80),
  state: z.enum(stateIds, { error: "Choose the state we should deliver to." }),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500, "Notes can be up to 500 characters.").optional(),
});

export const orderLineSchema = z.object({
  id: z.string().min(1),
  selectedSize: z.string().max(40),
  selectedColor: z.string().max(40),
  qty: z.number().int().min(1).max(99),
});

export const orderInputSchema = z.object({
  contact: contactSchema,
  delivery: deliverySchema,
  lines: z.array(orderLineSchema).min(1, "Your bag is empty."),
  promoCode: z.string().trim().max(40).optional(),
  confirmedTransfer: z.literal(true, { error: "Confirm that you have sent the payment." }),
});

export const trackSchema = z.object({
  order: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ORDER_NUMBER_PATTERN, "Order numbers look like LBS-18112026-0001."),
  email: z.email("Enter the email address used for the order."),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
export type ContactInput = z.input<typeof contactSchema>;
export type DeliveryInput = z.input<typeof deliverySchema>;

export function receiptProblem(file: {
  readonly size: number;
  readonly type: string;
}): string | null {
  if (file.size > MAX_RECEIPT_BYTES)
    return "That file is over 5 MB. Choose a smaller photograph or PDF.";
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type))
    return "Attach a photograph (JPG, PNG, WebP) or a PDF.";
  return null;
}
