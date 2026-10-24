import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { Auth } from "@repo/backend/confect/auth/runtime";
import {
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { authFetch } from "@/lib/auth/request";

function createBrowserAuthClient() {
  return createAuthClient({
    fetchOptions: { customFetchImpl: authFetch },
    plugins: [inferAdditionalFields<Auth>(), convexClient(), usernameClient()],
  });
}

/** The page's Better Auth client, created on first use so a visitor's page creates none. */
let shared: ReturnType<typeof createBrowserAuthClient> | undefined;

/** Returns the page's Better Auth client. Importing this module creates no client. */
export function readAuthClient() {
  shared ??= createBrowserAuthClient();
  return shared;
}
