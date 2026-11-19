/** Invented sign-ins for the development store. Shown only where `SHOW_DEMO_HINTS` allows (see data-mode.ts). */
export const DEMO = {
  customer: { email: "demo.customer@example.test", password: "Demo-Pass1!" },
  owner: { email: "owner@example.test", password: "Owner-Pass1!" },
  editor: { email: "editor@example.test", password: "Editor-Pass1!" },
} as const;
