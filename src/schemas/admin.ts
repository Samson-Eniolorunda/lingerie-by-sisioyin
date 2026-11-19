import "@/lib/zod-config";
import { z } from "zod";
import { endOfLagosDay } from "@/lib/dates";
import { normaliseNigerianPhone } from "@/lib/phone";
import { ORDER_STATUSES } from "@/types/account";

export const CATEGORIES = ["Lingerie", "Loungewear", "Underwear", "Accessories"] as const;
export const GENDERS = ["Women", "Men", "Kids", "Unisex"] as const;
export const SIZE_CHOICES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One Size"] as const;
export const PACK_TYPES = ["Single", "2-in-1", "3-in-1", "4-in-1"] as const;

export const variantSchema = z.object({
  size: z.string().trim().min(1, "Choose a size.").max(20),
  color: z.string().trim().max(40),
  qty: z.number().int("Use a whole number.").min(0, "Stock cannot be below zero.").max(100_000),
});

export const productDraftSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the product name.").max(120),
    category: z.enum(CATEGORIES, "Choose a category."),
    gender: z.enum(GENDERS, "Choose who it is for."),
    priceNgn: z
      .number("Enter the price.")
      .int("Use whole naira.")
      .min(100, "The price cannot be below ₦100.")
      .max(10_000_000),
    description: z.string().trim().max(2000),
    deliveryType: z.enum(["standard", "express"]),
    isNew: z.boolean(),
    active: z.boolean(),
    allowColourSelection: z.boolean(),
    packType: z.string().max(20),
    stockVersion: z.number().int().min(0).optional(),
    variants: z.array(variantSchema).max(200),
    images: z
      .array(z.object({ src: z.string().min(1).max(500), alt: z.string().trim().max(160) }))
      .max(8, "Use at most eight photographs."),
  })
  .superRefine((value, ctx) => {
    if (value.variants.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Add at least one size with its stock.",
      });
    if (value.allowColourSelection && value.variants.some((v) => v.color === ""))
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Every line needs a colour, or switch to an assorted pack.",
      });
  });

export const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, "Use 3 to 20 letters or numbers, with no spaces."),
  percent: z
    .number("Enter the percentage.")
    .int("Use a whole number.")
    .min(1, "At least 1%.")
    .max(90, "No more than 90%."),
  expiresAt: z
    .string()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a valid date.")
    .transform((v) => (v === "" ? null : endOfLagosDay(v))),
  usageLimit: z.number().int("Use a whole number.").min(1, "At least 1.").max(1_000_000).nullable(),
});

export const settingsSchema = z.object({
  announcement: z.string().trim().max(160, "Keep the announcement under 160 characters."),
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (v) => /^\d{10,15}$/.test(v),
      "Use digits only, with the country code, for example 2349033344860.",
    ),
  supportEmail: z.email("Enter a valid email address."),
  bankName: z.string().trim().min(2, "Enter the bank name.").max(80),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "An account number has 10 digits."),
  accountName: z.string().trim().min(2, "Enter the account name.").max(120),
  lowStockThreshold: z.number().int("Use a whole number.").min(0).max(1000),
  notifyNewOrders: z.boolean(),
});

export const inviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(["editor", "super_admin"]),
});

export const replySchema = z.object({
  body: z.string().trim().min(2, "Write your reply.").max(4000),
});

export const staffPhoneSchema = z
  .string()
  .refine((v) => v === "" || normaliseNigerianPhone(v) !== null, "Enter a Nigerian number.");

export type ProductDraftInput = z.infer<typeof productDraftSchema>;
export type PromoInput = z.input<typeof promoSchema>;

export const staffRoleSchema = z.enum(["super_admin", "editor"]);
export const customerStatusSchema = z.enum(["active", "suspended", "banned"]);
export const paymentDecisionSchema = z.enum(["confirmed", "rejected"]);
export const orderStatusSchema = z.enum(ORDER_STATUSES as [string, ...string[]]);
export const messageMarkSchema = z.enum(["read", "unread"]);

/** The amount of money that reached the account for a cancelled order, in whole naira (0 = nothing arrived). */
export const receivedAmountSchema = z.number().int().min(0).max(100_000_000);
