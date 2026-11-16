import { urlSchema } from "@repo/analytics/public";
import { readEnvironment } from "@repo/utilities/env";

/**
 * Reads the address of Google's ad script for the build and the Worker: Google's
 * own in every deployment, and the acceptance runtime's stand-in in a proof, so
 * no third-party script reaches a test. The policy of every page allows its
 * origin, and the Worker binds it with the other server values. The browser
 * reads the same name through `@/lib/ads/public`.
 */
export const adScriptKeys = () =>
  readEnvironment(
    { VITE_AD_SCRIPT_URL: urlSchema },
    { VITE_AD_SCRIPT_URL: process.env.VITE_AD_SCRIPT_URL }
  );
