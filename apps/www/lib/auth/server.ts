import "@tanstack/react-start/server-only";

import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { env } from "@/env";

const authServer = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
});

/** Answers every Better Auth request of the auth route, with its cookies kept. */
export const { handler } = authServer;
