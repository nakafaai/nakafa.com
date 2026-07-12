import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";

type TryoutReviewAccessArgs = FunctionArgs<
  typeof api.tryouts.queries.review.canReadSection
>;

/** Expected failure while authorizing server-rendered answer content. */
class TryoutReviewAccessError extends Schema.TaggedError<TryoutReviewAccessError>()(
  "TryoutReviewAccessError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Authorizes answer imports through an explicitly authenticated SSR query. */
export const canReadTryoutAnswers = Effect.fn("www.tryout.review.access")(
  function* (token: string, args: TryoutReviewAccessArgs) {
    return yield* Effect.tryPromise({
      try: () =>
        fetchQuery(api.tryouts.queries.review.canReadSection, args, { token }),
      catch: (cause) =>
        new TryoutReviewAccessError({
          cause,
          message: "Unable to authorize try-out answer review.",
        }),
    });
  }
);
