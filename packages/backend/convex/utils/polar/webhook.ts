import { requirePolarEnv } from "@repo/backend/convex/utils/polar/env";

/** Return the Polar webhook secret used to verify incoming webhook signatures. */
export const polarWebhookSecret = requirePolarEnv("POLAR_WEBHOOK_SECRET");
