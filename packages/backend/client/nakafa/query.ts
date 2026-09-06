import { readConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type ContentRuntimeQuery = FunctionReference<"query">;

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
