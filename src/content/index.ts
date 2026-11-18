import faqJson from "./faq.json";
import privacyJson from "./privacy.json";
import termsJson from "./terms.json";
import { faqSchema, legalSchema } from "./schema";

export const FAQ_GROUPS = faqSchema.parse(faqJson);
export const PRIVACY = legalSchema.parse(privacyJson);
export const TERMS = legalSchema.parse(termsJson);
