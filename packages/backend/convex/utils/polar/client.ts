import { PolarCore } from "@polar-sh/sdk/core.js";
import { polarServer } from "@repo/backend/convex/utils/polar/config";
import { requirePolarEnv } from "@repo/backend/convex/utils/polar/env";

/**
 * Shared Polar SDK client instance.
 * Polar's SDK docs describe instantiating one client at application start and
 * reusing it across calls.
 */
export const polarClient = new PolarCore({
  accessToken: requirePolarEnv("POLAR_ACCESS_TOKEN"),
  server: polarServer,
});
