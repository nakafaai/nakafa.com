import "server-only";

import type { ContentSources } from "@repo/backend/content/snapshot/context";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { fetchQuery } from "convex/nextjs";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect } from "effect";
import { env } from "@/env";
import { loadContentSnapshot } from "@/lib/content/runtime/snapshot";

/** Reads one public query without starting an Effect runtime during prerender. */
export async function fetchRuntimeQuery<
  Query extends FunctionReference<"query">,
>(
  query: Query,
  args: FunctionArgs<Query>,
  read: (
    args: FunctionArgs<Query>
  ) => Effect.Effect<FunctionReturnType<Query>, unknown, ContentSources>
): Promise<FunctionReturnType<Query>> {
  const snapshot = await loadContentSnapshot();
  if (snapshot !== undefined) {
    return await Effect.runPromise(
      read(args).pipe(Effect.provideContext(snapshot))
    );
  }
  return await fetchQuery(query, args, {
    url: env.NEXT_PUBLIC_CONVEX_URL,
  });
}

/** Reads one query through the Effect-native agent data-read error channel. */
export const readRuntimeQuery = Effect.fn("www.contentRuntime.query")(
  function* <Query extends FunctionReference<"query">>(
    query: Query,
    args: FunctionArgs<Query>,
    read: (
      args: FunctionArgs<Query>
    ) => Effect.Effect<FunctionReturnType<Query>, unknown, ContentSources>
  ) {
    return yield* Effect.tryPromise({
      try: () => fetchRuntimeQuery(query, args, read),
      catch: (cause) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(cause),
          message: "Unable to read the selected Nakafa content runtime.",
        }),
    });
  }
);
