import { publicationKeys, siteUrlKeys } from "@repo/next-config/keys";
import { clientEnv } from "@/env.client";

/**
 * Validates environment values consumed by `www` server modules. The browser
 * imports `@/env.client`, which holds only public values.
 *
 * Package-specific integrations such as AI clients, CAS, Polar, and Convex
 * backend functions keep their own env contracts at the capability that reads
 * those values.
 */
export const env = {
  ...clientEnv,
  ...publicationKeys(),
  ...siteUrlKeys(),
};
