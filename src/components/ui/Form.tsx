"use client";

import type { ComponentProps } from "react";

/**
 * A form that keeps the focused field clear of the on-screen keyboard: the viewport resizes with the
 * keyboard (see the viewport setting), and the focused control is brought to the middle of what is
 * left. The submit button stays in the page flow, so it is never covered.
 */
export function Form({ onFocus, noValidate = true, ...rest }: ComponentProps<"form">) {
  return (
    <form
      noValidate={noValidate}
      onFocus={(event) => {
        onFocus?.(event);
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          window.setTimeout(
            () => target.scrollIntoView({ block: "center", behavior: "smooth" }),
            250,
          );
        }
      }}
      {...rest}
    />
  );
}
