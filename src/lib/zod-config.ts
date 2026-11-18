import { z } from "zod";

/**
 * Zod probes whether `new Function` is allowed and, in a page with a strict content security policy,
 * the probe itself is reported as an eval violation. Switching the just-in-time compiler off skips the
 * probe; validation is unchanged and the schemas here are small, so nothing measurable is lost.
 */
z.config({ jitless: true });
