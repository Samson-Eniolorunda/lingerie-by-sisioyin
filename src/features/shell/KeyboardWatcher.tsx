"use client";

import { useEffect } from "react";

/**
 * Marks the document while a text field has focus on a touch device, so sticky action bars can step
 * aside instead of covering the field being typed in (`html[data-keyboard-open] [data-keyboard-hide]`).
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    const isField = (el: EventTarget | null): boolean =>
      el instanceof HTMLElement &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) &&
      !/^(checkbox|radio|button|file|submit)$/.test((el as HTMLInputElement).type ?? "");
    const coarse = window.matchMedia("(pointer: coarse)");
    const onIn = (e: FocusEvent) => {
      if (coarse.matches && isField(e.target)) root.dataset.keyboardOpen = "";
    };
    const onOut = () => {
      delete root.dataset.keyboardOpen;
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return null;
}
