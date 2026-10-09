import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { Auth } from "@repo/backend/confect/auth/runtime";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { authFetch } from "@/lib/auth/request";

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: authFetch },
  plugins: [inferAdditionalFields<Auth>(), convexClient()],
});
