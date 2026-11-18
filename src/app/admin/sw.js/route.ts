import { serviceWorkerSource } from "@/lib/service-worker";

export function GET(): Response {
  return new Response(serviceWorkerSource("lbs-admin-v1", "/admin"), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/admin",
    },
  });
}
