import { adminPath } from "@/lib/adminPath";
import { serviceWorkerSource } from "@/lib/service-worker";

/** `/` on the admin host, `/admin` where the panel lives under the shop. */
const scope = adminPath("/");

export function GET(): Response {
  return new Response(serviceWorkerSource("lbs-admin-v1", scope), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": scope,
    },
  });
}
