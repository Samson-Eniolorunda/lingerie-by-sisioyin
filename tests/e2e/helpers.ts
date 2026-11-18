import type { Page } from "@playwright/test";

export const PHONE_WIDTHS = [360, 390, 430] as const;

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Buttons and navigation links that are visible but smaller than 44 x 44 px. */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      "button, nav a, [role='radio'], [role='tab'], summary",
    )) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        style.visibility === "hidden" ||
        style.display === "none"
      )
        continue;
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      if (rect.width < 43.5 || rect.height < 43.5) {
        found.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
    return found;
  });
}
