import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { auth } from "@repo/backend/convex/betterAuth/auth";
import {
  anonymousClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    anonymousClient(),
    convexClient(),
  ],
});
