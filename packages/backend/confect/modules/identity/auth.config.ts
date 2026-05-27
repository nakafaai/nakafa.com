import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { authEnvironment } from "@repo/backend/confect/modules/identity/auth.env";

/** Better Auth JWT provider config consumed by the Convex auth boundary. */
export default {
  providers: [getAuthConfigProvider({ jwks: authEnvironment.jwks })],
};
