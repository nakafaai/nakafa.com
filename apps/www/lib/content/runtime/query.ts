import { readConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";
import { env } from "@/env";

/** Reads one query through the Effect-native agent data-read error channel. */
export const readRuntimeQuery = Effect.fn("www.contentRuntime.query")(
  function* <Query extends FunctionReference<"query">>(
    query: Query,
    args: FunctionArgs<Query>
  ) {
    return yield* readConvexRuntimeQuery(
      env.NEXT_PUBLIC_CONVEX_URL,
      query,
      args
    ).pipe(
      Effect.mapError(
        (error) =>
          new NakafaAgentDataReadError({
            cause: error.message,
            message: `Unable to read Nakafa runtime content query: ${error.query}.`,
          })
      )
    );
  }
);
