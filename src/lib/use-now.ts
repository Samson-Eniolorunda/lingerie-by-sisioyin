"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let current = 0;
let timer: number | undefined;

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) window.clearInterval(timer);
  };
}

/** The current time in milliseconds, refreshed every second; 0 on the server and before mounting. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
