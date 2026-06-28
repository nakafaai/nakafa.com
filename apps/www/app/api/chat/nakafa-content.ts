import { makeConvexNakafa } from "@repo/backend/client/nakafa/adapter";
import { env } from "@/env";

/** Convex-backed Nakafa content adapter for Nina. */
export const nakafaContent = makeConvexNakafa({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
});
