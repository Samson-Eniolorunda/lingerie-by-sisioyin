"use client";

import { useEffect } from "react";

/** Tells the shell a sticky action bar is on this page, so the WhatsApp button and toasts clear it. */
export function HasBar() {
  useEffect(() => {
    document.documentElement.dataset.bar = "";
    return () => {
      delete document.documentElement.dataset.bar;
    };
  }, []);
  return null;
}
