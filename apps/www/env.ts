import { convexKeys, convexSiteKeys } from "@repo/backend/keys";
import { contentApiKeys, mcpKeys, siteUrlKeys } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";

/**
 * Validates environment values consumed by `www` runtime modules.
 *
 * Package-specific integrations such as AI clients, CAS, Polar, and Convex
 * backend functions keep their own env contracts at the capability that reads
 * those values.
 */
export const env = createEnv({
  extends: [
    contentApiKeys(),
    siteUrlKeys(),
    convexKeys(),
    convexSiteKeys(),
    mcpKeys(),
  ],
  runtimeEnv: {},
});
