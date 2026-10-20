import type { AnyPublicQuery, Args, Returns } from "@confect/core/Ref";
import {
  decodeReturns,
  encodeArgs,
  getFunctionReference,
} from "@confect/core/Ref";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { clientEnv } from "@/env.client";
import { readConvexClient } from "@/lib/convex/client.client";
import { runServerEffect } from "@/lib/server/fn";

/** A browser read of a Confect query that Convex refused before it answered. */
export class BrowserQueryFailed extends Schema.TaggedError<BrowserQueryFailed>()(
  "BrowserQueryFailed",
  { cause: Schema.Unknown }
) {}

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
 * Reads one query through the shared browser client, and decodes its value with
 * the query's Schema. A value of another shape fails the decode, so the loader
 * never hands the page an unchecked answer.
 */
const readBrowserValue = Effect.fn("www.data.browserQuery")(function* <
  Query extends AnyPublicQuery,
>(ref: Query, args: Args<Query>) {
  const client = readConvexClient(clientEnv.VITE_CONVEX_URL);
  const encodedArgs = yield* encodeArgs(ref, args);
  const encoded = yield* Effect.tryPromise({
    catch: (cause) => new BrowserQueryFailed({ cause }),
    try: () => client.query(getFunctionReference(ref), encodedArgs),
  });
  return yield* decodeReturns(ref, encoded);
});

/**
 * The browser branch of a route loader. It reads once through the shared client,
 * so a page whose first value was preloaded makes no read when it hydrates.
 */
export function readBrowserQuery<Query extends AnyPublicQuery>(
  ref: Query,
  args: Args<Query>
): Promise<Returns<Query>> {
  return Effect.runPromise(readBrowserValue(ref, args));
}

/**
 * Reads one Confect query for a route loader. The build keeps each branch to its
 * own environment, so the browser never bundles the server's read.
 */
export const loadConfectQuery = createIsomorphicFn()
  .server(readServerQuery)
  .client(readBrowserQuery);
