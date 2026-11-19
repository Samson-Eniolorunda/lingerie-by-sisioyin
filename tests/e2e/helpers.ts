import { createHash } from "node:crypto";
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

export const DEMO_CUSTOMER = {
  email: "demo.customer@example.test",
  password: "Demo-Pass1!",
} as const;
export const DEMO_OWNER = { email: "owner@example.test", password: "Owner-Pass1!" } as const;
export const DEMO_EDITOR = { email: "editor@example.test", password: "Editor-Pass1!" } as const;

let counter = 0;
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}.${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function signInAs(
  page: Page,
  who: { email: string; password: string },
  path = "/sign-in",
): Promise<void> {
  await page.goto(path);
  await page.getByLabel("Email address").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Creates a throwaway customer through the sign-up screen and leaves the page signed in. */
export async function signUpFresh(page: Page, password = "Fresh-Pass1!"): Promise<string> {
  const email = uniqueEmail("fresh");
  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("Person");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  return email;
}

/**
 * Product ids. The development store uses `fixture-NN`; the local Supabase stack seeds the same
 * products under deterministic UUIDs (tests/support/local-stack/seed.mjs). `LBS_E2E_DATA=supabase`
 * selects the second.
 */
export function productId(fixtureId: string): string {
  if (process.env.LBS_E2E_DATA !== "supabase") return fixtureId;
  const h = createHash("sha1").update(`lbs:${fixtureId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const SUPABASE_E2E = process.env.LBS_E2E_DATA === "supabase";
