import { publicEnv } from "./env";

export const BRAND = {
  /** The logo and the emails use this spelling; the live site mixes two (decision in plan 9.5). */
  name: "Lingeries by Sisioyin",
  tagline: "Lingerie, loungewear and underwear, made for everyday comfort.",
  siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
} as const;

export const CONTACT = {
  whatsappNumber: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER,
  phoneDisplay: "+234 903 334 4860",
  phoneLink: "tel:+2349033344860",
  email: "support@lingeriebysisioyin.store",
  instagram: "https://instagram.com/lingeries_bysisioyin",
  tiktok: "https://tiktok.com/@lingeries_bysisioyin",
} as const;

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${CONTACT.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** The single place the bank transfer details live (plan STR-10). To be confirmed by the owner. */
export const BANK = {
  bankName: "Moniepoint MFB",
  accountNumber: "6327082294",
  accountName: "Oyindamola Adelugba (LingeriesBySisioyin)",
} as const;

export const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?gender=Women", label: "Women" },
  { href: "/shop?gender=Men", label: "Men" },
  { href: "/shop?gender=Kids", label: "Kids" },
] as const;

export const CATEGORY_LINKS = [
  { href: "/shop?category=Lingerie", label: "Lingerie" },
  { href: "/shop?category=Loungewear", label: "Loungewear" },
  { href: "/shop?category=Underwear", label: "Underwear" },
] as const;

export const SUPPORT_LINKS = [
  { href: "/faq", label: "FAQs" },
  { href: "/size", label: "Size guide" },
  { href: "/contact", label: "Contact" },
  { href: "/track", label: "Track an order" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;
