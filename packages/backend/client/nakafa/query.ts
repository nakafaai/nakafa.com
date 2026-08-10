import { readConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type ContentRuntimeQuery = FunctionReference<"query">;

/** Maximum page size used by app-level Convex runtime catalog readers. */
export const NAKAFA_RUNTIME_PAGE_SIZE = 100;

/** Initial cursor used by Convex paginated runtime readers. */
export const NAKAFA_INITIAL_CURSOR: string | null = null;

/** Reads one generated Convex query through the agent error channel. */
export const readNakafaRuntimeQuery = Effect.fn(
  "NakafaContent.readRuntimeQuery"
)(function* <Query extends ContentRuntimeQuery>(
  convexUrl: string,
  query: Query,
  args: FunctionArgs<Query>
) {
  return yield* readConvexRuntimeQuery(convexUrl, query, args).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: error.message,
          message: `Unable to read Nakafa runtime content query: ${error.query}.`,
        })
    )
  );
});
