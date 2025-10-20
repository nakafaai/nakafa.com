import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth";
import type { auth } from "@repo/backend/convex/betterAuth/auth";
import {
  anonymousClient,
  apiKeyClient,
  inferAdditionalFields,
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    anonymousClient(),
    organizationClient(),
    apiKeyClient(),
    usernameClient(),
    polarClient(),
    convexClient(),
  ],
});
