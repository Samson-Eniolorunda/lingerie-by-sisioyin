"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { publicEnv } from "@/config/env";
import { analyticsAllowed } from "@/lib/consent";
import { useConsent } from "./ConsentBanner";

const GA_SRC = "https://www.googletagmanager.com/gtag/js?id=";
const FB_SRC = "https://connect.facebook.net/en_US/fbevents.js";

function referrerOrigin(): string | undefined {
  try {
    return document.referrer ? new URL(document.referrer).origin : undefined;
  } catch {
    return undefined;
  }
}

function addScript(id: string, src: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Loads Google Analytics and the Meta Pixel only when the visitor has accepted analytics and the ids
 * are configured. With no consent, or no ids, this renders nothing and makes no request.
 */
export function AnalyticsLoader() {
  const allowed = analyticsAllowed(useConsent());
  const pathname = usePathname();
  const ga = publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const fb = publicEnv.NEXT_PUBLIC_FB_PIXEL_ID;

  useEffect(() => {
    if (!allowed) return;
    if (ga && !window.gtag) {
      window.dataLayer = window.dataLayer ?? [];
      window.gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };
      window.gtag("js", new Date());
      window.gtag("config", ga, { send_page_view: false, anonymize_ip: true });
      addScript("ga-script", `${GA_SRC}${encodeURIComponent(ga)}`);
    }
    if (fb && !window.fbq) {
      // The queue shape fbevents.js expects: calls are held until the script arrives and replays them.
      const stub = Object.assign(
        (...args: unknown[]) => {
          if (stub.callMethod) stub.callMethod(...args);
          else stub.queue.push(args);
        },
        {
          queue: [] as unknown[][],
          loaded: true,
          version: "2.0",
          callMethod: undefined as ((...args: unknown[]) => void) | undefined,
        },
      );
      window.fbq = Object.assign(stub, { push: stub });
      window.fbq("init", fb);
      addScript("fb-script", FB_SRC);
    }
  }, [allowed, ga, fb]);

  useEffect(() => {
    if (!allowed) return;
    window.gtag?.("event", "page_view", { page_path: pathname });
    window.fbq?.("track", "PageView");
  }, [allowed, pathname]);

  // The shop's own page-view count for the admin analytics page: the page, the kind of device and
  // the browser, nothing that identifies the visitor. Only after consent.
  useEffect(() => {
    if (!allowed) return;
    const width = window.innerWidth;
    const ua = navigator.userAgent;
    const browser = /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Edg\//.test(ua)
        ? "Edge"
        : /Firefox/.test(ua)
          ? "Firefox"
          : /Chrome|CriOS/.test(ua)
            ? "Chrome"
            : /Safari/.test(ua)
              ? "Safari"
              : "Other";
    void fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        page: pathname,
        referrer: referrerOrigin(),
        deviceType: width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop",
        browser,
        os: /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad/.test(ua)
            ? "iOS"
            : /Windows/.test(ua)
              ? "Windows"
              : /Mac/.test(ua)
                ? "macOS"
                : "Other",
        screen: `${screen.width}x${screen.height}`,
        viewport: `${width}x${window.innerHeight}`,
      }),
    }).catch(() => undefined);
  }, [allowed, pathname]);

  return null;
}
