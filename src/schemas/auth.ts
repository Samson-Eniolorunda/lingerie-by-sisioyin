import { z } from "zod";
import { normaliseNigerianPhone } from "@/lib/phone";

export interface PasswordRule {
  readonly id: string;
  readonly label: string;
  readonly test: (value: string) => boolean;
}

/** The five rules of A-03, shown live while typing and enforced again on the server. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "An upper-case letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lower-case letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v) => /\d/.test(v) },
  { id: "special", label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 | 5 {
  return PASSWORD_RULES.filter((r) => r.test(value)).length as 0 | 1 | 2 | 3 | 4 | 5;
}

export const STRENGTH_LABELS = ["Too short", "Weak", "Weak", "Fair", "Good", "Strong"] as const;

const email = z.email("Enter a valid email address, for example name@example.com.").max(120);

const newPassword = z
  .string()
  .min(1, "Choose a password.")
  .refine(
    (v) => PASSWORD_RULES.every((r) => r.test(v)),
    "Use at least 8 characters with upper and lower case, a number and a special character.",
  );

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, "Repeat your password."),
    acceptTerms: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword)
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    if (!v.acceptTerms)
      ctx.addIssue({
        code: "custom",
        path: ["acceptTerms"],
        message: "Accept the terms and the privacy policy to continue.",
      });
  });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({
    token: z.string().min(10),
    password: newPassword,
    confirmPassword: z.string().min(1, "Repeat your password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords do not match.",
  });

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine(
      (v) => v === "" || normaliseNigerianPhone(v) !== null,
      "Enter a Nigerian number, such as 08012345678, or leave this blank.",
    ),
  dateOfBirth: z
    .string()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.")
    .refine((v) => v === "" || new Date(v) < new Date(), "Your date of birth must be in the past."),
  gender: z.enum(["", "female", "male", "other"]),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1, "Name this address, for example Home.").max(30),
  recipient: z.string().trim().min(2, "Enter the recipient's name.").max(80),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number.")
    .refine(
      (v) => normaliseNigerianPhone(v) !== null,
      "Enter a Nigerian number, such as 08012345678.",
    ),
  line1: z.string().trim().min(5, "Enter the street address.").max(200),
  city: z.string().trim().min(2, "Enter the city or town.").max(80),
  state: z.string().min(1, "Choose a state."),
  isDefault: z.boolean(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}
