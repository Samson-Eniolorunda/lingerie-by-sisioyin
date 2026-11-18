import { z } from "zod";

export type ContentNode =
  | string
  | {
      t:
        | "p"
        | "ul"
        | "ol"
        | "li"
        | "strong"
        | "em"
        | "br"
        | "h3"
        | "h4"
        | "table"
        | "thead"
        | "tbody"
        | "tr"
        | "th"
        | "td"
        | "div"
        | "a";
      c: ContentNode[];
      href?: string | undefined;
      callout?: boolean | undefined;
    };

const TAGS = [
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "br",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "a",
] as const;

export const contentNodeSchema: z.ZodType<ContentNode> = z.lazy(() =>
  z.union([
    z.string(),
    z.object({
      t: z.enum(TAGS),
      c: z.array(contentNodeSchema),
      href: z.string().optional(),
      callout: z.boolean().optional(),
    }),
  ]),
);

export const faqSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.array(contentNodeSchema) })),
  }),
);

export const legalSchema = z.object({
  updated: z.string(),
  intro: z.array(contentNodeSchema),
  sections: z.array(
    z.object({ id: z.string(), title: z.string(), body: z.array(contentNodeSchema) }),
  ),
});
