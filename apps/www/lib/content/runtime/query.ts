import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect } from "effect";
import { env } from "@/env";

/**
 * Fetches one public content-runtime query through the official Convex client.
 *
 * `convex/nextjs` does not expose logger configuration. Its default
 * `ConvexHttpClient` logger allocates a random listener id, which Next Cache
 * Components reject during static prerender. A short-lived official client with
 * `logger: false` and a public custom fetch keeps this boundary framework-safe
 * without copying protocol.
 */
export function fetchRuntimeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return fetchConvexRuntimeQuery(env.NEXT_PUBLIC_CONVEX_URL, query, args);
}

/** Wraps a Convex runtime query in the agent data-read error model. */
export function readRuntimeQuery<T>(name: string, read: () => Promise<T>) {
  return Effect.tryPromise({
    try: read,
    /** Converts Convex/runtime read failures into the agent data-read error. */
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: `Unable to read Nakafa runtime content query: ${name}.`,
      }),
  });
}
