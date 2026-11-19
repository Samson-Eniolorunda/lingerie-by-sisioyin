"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The privacy policy links to `/dashboard#settings` (R-20); the settings live on their own page. */
export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const check = () => {
      if (window.location.hash === "#settings") router.replace("/dashboard/settings");
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [router]);
  return null;
}
