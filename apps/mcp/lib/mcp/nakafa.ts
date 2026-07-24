import { makeConvexNakafa } from "@repo/backend/client/nakafa/adapter";
import { env } from "@/env";

/** Convex-backed Nakafa runtime adapter for MCP tools and resources. */
export const nakafaContent = makeConvexNakafa({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  runtimeToken: env.CONTENT_RUNTIME_TOKEN,
  siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
});
