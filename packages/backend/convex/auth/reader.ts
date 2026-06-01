import { createClient } from "@convex-dev/better-auth";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import authSchema from "@repo/backend/convex/betterAuth/schema";

/**
 * Lightweight Better Auth component client for read-side auth helpers.
 *
 * Trigger callbacks stay in auth/client.ts so hot user reads do not import
 * signup side effects, analytics, email scheduling, or customer sync modules.
 */
export const authReader = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
    verbose: false,
  }
);
