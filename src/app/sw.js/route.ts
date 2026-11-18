import { serviceWorkerSource } from "@/lib/service-worker";

export function GET(): Response {
  return new Response(serviceWorkerSource("lbs-store-v1", "/"), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
