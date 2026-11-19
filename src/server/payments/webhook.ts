import { NextResponse } from "next/server";
import { DATA_MODE } from "@/config/data-mode";
import type { GatewayId } from "./provider";
import { PROVIDERS } from "./index";

/**
 * The shared body of the two webhook routes. A delivery is refused unless the provider is
 * configured (503) and its signature is valid (401). A valid delivery is recorded once (a replay is
 * acknowledged and ignored). Nothing yet turns an event into an order change, because no order can
 * be paid through a gateway until one is integrated; the event is stored for that day.
 */
export async function handleWebhook(request: Request, gateway: GatewayId): Promise<NextResponse> {
  const provider = PROVIDERS[gateway];
  if (!provider.isConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const rawBody = await request.text();
  const headers: Record<string, string | null> = {
    "x-paystack-signature": request.headers.get("x-paystack-signature"),
    "verif-hash": request.headers.get("verif-hash"),
  };
  const event = provider.verifyWebhook(rawBody, headers);
  if (!event) return NextResponse.json({ ok: false }, { status: 401 });
  if (DATA_MODE === "supabase") {
    const { serviceClient } = await import("@/server/supabase/clients");
    const { data, error } = await serviceClient().rpc("record_gateway_event", {
      p_provider: gateway,
      p_event_id: event.id,
      p_payload: event.raw,
    });
    if (error) return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.json({ ok: true, duplicate: data === false });
  }
  return NextResponse.json({ ok: true });
}
