import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { authEnvironment } from "@repo/backend/confect/modules/identity/auth.env";
import type { AuthConfig } from "convex/server";

/** Convex auth config source generated into convex/auth.config.ts by Confect. */
export default {
  providers: [getAuthConfigProvider({ jwks: authEnvironment.jwks })],
} satisfies AuthConfig;
