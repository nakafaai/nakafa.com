import { timingSafeEqual } from "@repo/utilities/security";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { revalidateContentRuntimeCache } from "@/lib/content/cache";

const BEARER_PREFIX = "Bearer ";

/**
 * Returns the bearer token from one Authorization header.
 */
function getBearerToken(header: string | null) {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return;
  }

  return header.slice(BEARER_PREFIX.length);
}

/**
 * Revalidates Convex-backed content runtime cache tags for trusted sync scripts.
 */
export const POST = async (request: NextRequest) =>
  await Effect.runPromise(
    Effect.sync(() => {
      const token = getBearerToken(request.headers.get("Authorization"));
      const isAuthorized = timingSafeEqual(token, env.INTERNAL_CONTENT_API_KEY);

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tags = revalidateContentRuntimeCache();

      return NextResponse.json({ revalidated: true, tags });
    })
  );
