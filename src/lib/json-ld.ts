/** JSON for a `<script type="application/ld+json">`: `<` is escaped so no text can close the tag early. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
