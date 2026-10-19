import type { AnyPublicQuery, Args, Returns } from "@confect/core/Ref";
import {
  decodeReturnsSync,
  encodeArgsSync,
  getFunctionReference,
} from "@confect/core/Ref";
import { createIsomorphicFn } from "@tanstack/react-start";
import { readConvexClient } from "@/lib/convex/client.client";
import { runServerEffect } from "@/lib/server/fn";

/**
 * The server branch of a route loader. It reads the request's own token through
 * the server preload, which the browser never bundles.
 */
export async function readServerQuery<Query extends AnyPublicQuery>(
  ref: Query,
  args: Args<Query>,
  token: string | undefined
): Promise<Returns<Query>> {
  const { preloadConfectQuery } = await import("@/lib/data/preload.server");
  return runServerEffect(preloadConfectQuery(ref, args, token));
}

/**
 * The browser branch of a route loader. It reads once through the shared client,
 * so a page whose first value was preloaded makes no read when it hydrates.
 */
export async function readBrowserQuery<Query extends AnyPublicQuery>(
  ref: Query,
  args: Args<Query>
): Promise<Returns<Query>> {
  const client = readConvexClient(import.meta.env.VITE_CONVEX_URL);
  const encoded = await client.query(
    getFunctionReference(ref),
    encodeArgsSync(ref, args)
  );
  return decodeReturnsSync(ref, encoded);
}

/**
 * Reads one Confect query for a route loader. The build keeps each branch to its
 * own environment, so the browser never bundles the server's read.
 */
export const loadConfectQuery = createIsomorphicFn()
  .server(readServerQuery)
  .client(readBrowserQuery);
