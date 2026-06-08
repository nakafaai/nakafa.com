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

type ContentRuntimeQuery = FunctionReference<"query">;

/** Maximum page size used by app-level Convex runtime catalog readers. */
export const NAKAFA_RUNTIME_PAGE_SIZE = 100;

/** Initial cursor used by Convex paginated runtime readers. */
export const NAKAFA_INITIAL_CURSOR: string | null = null;

/** Fetches one generated Convex runtime query with agent read errors. */
export function fetchNakafaRuntimeQuery<Query extends ContentRuntimeQuery>(
  convexUrl: string,
  name: string,
  query: Query,
  args: FunctionArgs<Query>
): Effect.Effect<FunctionReturnType<Query>, NakafaAgentDataReadError> {
  return Effect.tryPromise({
    /** Runs the official Convex client query with the shared no-store client. */
    try: () => fetchConvexRuntimeQuery(convexUrl, query, args),
    /** Maps client failures into the shared Nakafa data-read error model. */
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: `Unable to read Nakafa runtime content query: ${name}.`,
      }),
  });
}
