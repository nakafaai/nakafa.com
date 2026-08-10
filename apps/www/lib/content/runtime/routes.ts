import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type ContentRouteArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getContentRoute
>;
type TryoutRouteArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getRoute
>;

/** Reads one exact route-catalog row from the Convex content runtime model. */
export const getRuntimeContentRoute = Effect.fn(
  "www.contentRuntime.contentRoute"
)(function* (args: ContentRouteArgs) {
  return yield* readRuntimeQuery(
    api.contents.queries.runtime.getContentRoute,
    args
  );
});

/** Resolves one localized public path against signed try-out ownership. */
export const getRuntimeTryoutRoute = Effect.fn(
  "www.contentRuntime.tryoutRoute"
)(function* (args: TryoutRouteArgs) {
  return yield* readRuntimeQuery(api.tryouts.queries.catalog.getRoute, args);
});
