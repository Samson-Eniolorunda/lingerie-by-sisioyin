/** Carries an email typed on the sign-in screen to the forgotten-password screen, so it is not typed twice. */
export function forgotLinkFor(base: string, email: string): string {
  const trimmed = email.trim();
  return trimmed.includes("@") ? `${base}?email=${encodeURIComponent(trimmed)}` : base;
}
