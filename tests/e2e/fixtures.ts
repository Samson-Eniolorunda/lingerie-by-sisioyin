import { test as base, expect } from "@playwright/test";

/**
 * Every navigation waits for the shell to finish hydrating (`html[data-hydrated]`), so a test never
 * taps a server-rendered control before its handler is attached.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
      return response;
    };
    await provide(page);
  },
});

export { expect };
