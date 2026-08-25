import { makeConvexNakafa } from "@repo/backend/client/nakafa/adapter";
import { readContentRuntimeTarget } from "@repo/next-config/keys";
import { env } from "@/env";

/** Convex-backed Nakafa runtime adapter for MCP tools and resources. */
export const nakafaContent = makeConvexNakafa({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  readContentTarget: () =>
    readContentRuntimeTarget(env.NEXT_PUBLIC_CONVEX_SITE_URL),
});
