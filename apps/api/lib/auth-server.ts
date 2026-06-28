import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { env } from "@/env";

const authServer = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
});

export const { handler } = authServer;
