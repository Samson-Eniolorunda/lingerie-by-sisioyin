import { clientIp } from "@/server/auth/request";
import { turnstileTokenOf, verifyTurnstile, type TurnstileResult } from "@/server/turnstile";

/** The security check for a form's server action: its token and the caller's address. */
export async function humanCheck(input: unknown): Promise<TurnstileResult> {
  return verifyTurnstile(turnstileTokenOf(input), await clientIp());
}
