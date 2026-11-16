import { urlSchema } from "@repo/analytics/public";
import { readEnvironment } from "@repo/utilities/env";

/**
 * Reads the address of Google's ad script in the browser, which the build inlines.
 * The build and the Worker read the same name through `@/lib/ads/keys`.
 */
export const adScriptPublicKeys = () =>
  readEnvironment(
    { VITE_AD_SCRIPT_URL: urlSchema },
    { VITE_AD_SCRIPT_URL: import.meta.env.VITE_AD_SCRIPT_URL }
  );
