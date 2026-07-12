import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";

type TryoutContentAccessArgs = FunctionArgs<
  typeof api.tryouts.queries.access.getSectionContent
>;

/** Expected failure while authorizing server-rendered try-out content. */
class TryoutContentAccessError extends Schema.TaggedError<TryoutContentAccessError>()(
  "TryoutContentAccessError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Reads authenticated question and answer capabilities for one section. */
export const readTryoutContentAccess = Effect.fn("www.tryout.content.access")(
  function* (token: string, args: TryoutContentAccessArgs) {
    return yield* Effect.tryPromise({
      try: () =>
        fetchQuery(api.tryouts.queries.access.getSectionContent, args, {
          token,
        }),
      catch: (cause) =>
        new TryoutContentAccessError({
          cause,
          message: "Unable to authorize try-out content.",
        }),
    });
  }
);
