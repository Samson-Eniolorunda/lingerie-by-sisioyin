import "@/lib/zod-config";
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FB_PIXEL_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string()
    .regex(/^\d{10,15}$/)
    .default("2349033344860"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.email(),
  EMAIL_SUPPORT_ADDRESS: z.email(),
  RECAPTCHA_SECRET_KEY: z.string().min(1),
});

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

/** Variables that may reach the browser. Each is read by name so the bundler can inline it. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: emptyToUndefined(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
  NEXT_PUBLIC_FB_PIXEL_ID: emptyToUndefined(process.env.NEXT_PUBLIC_FB_PIXEL_ID),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
  NEXT_PUBLIC_WHATSAPP_NUMBER: emptyToUndefined(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
});

/** Server-only secrets. Parsed on demand so a missing value fails where it is needed, with its name. */
export function serverEnv(): z.infer<typeof serverSchema> {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server environment variables: ${names}`);
  }
  return parsed.data;
}
