/** Only same-site paths may follow a sign-in: no other host, no protocol-relative `//`, no backslashes. */
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
