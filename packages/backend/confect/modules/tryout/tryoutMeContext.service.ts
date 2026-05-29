import { GenericId } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import type {
  TryoutAttempts,
  Tryouts,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect, Option, Schema } from "effect";

const decodeTryoutAttemptId = Schema.decodeUnknownOption(
  GenericId.GenericId("tryoutAttempts")
);

/** Loads the newest attempt for a user and tryout. */
export const loadLatestUserTryoutAttempt = Effect.fnUntraced(function* (args: {
  readonly tryoutId: Id<"tryouts">;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("tryoutAttempts")
    .index(
      "by_userId_and_tryoutId_and_startedAt",
      (query) => query.eq("userId", args.userId).eq("tryoutId", args.tryoutId),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});

/** Resolves a route and optional attempt id to the user's visible attempt. */
export const loadResolvedUserTryoutContext = Effect.fnUntraced(
  function* (args: {
    readonly attemptId?: string;
    readonly locale: Locale;
    readonly product: TryoutProduct;
    readonly tryoutSlug: string;
    readonly userId: Id<"users">;
  }) {
    const reader = yield* DatabaseReader;
    const tryout = yield* reader
      .table("tryouts")
      .index("by_product_and_locale_and_slug", (query) =>
        query
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("slug", args.tryoutSlug)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (!tryout) {
      return null;
    }

    if (!args.attemptId) {
      const attempt = yield* loadLatestUserTryoutAttempt({
        tryoutId: tryout._id,
        userId: args.userId,
      });
      return attempt ? { attempt, tryout } : null;
    }

    const normalizedAttemptId = Option.getOrNull(
      decodeTryoutAttemptId(args.attemptId)
    );

    if (!normalizedAttemptId) {
      const attempt = yield* loadLatestUserTryoutAttempt({
        tryoutId: tryout._id,
        userId: args.userId,
      });
      return attempt ? { attempt, tryout } : null;
    }

    const selectedAttempt = yield* reader
      .table("tryoutAttempts")
      .get(normalizedAttemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (
      selectedAttempt &&
      selectedAttempt.tryoutId === tryout._id &&
      selectedAttempt.userId === args.userId
    ) {
      return { attempt: selectedAttempt, tryout };
    }

    const attempt = yield* loadLatestUserTryoutAttempt({
      tryoutId: tryout._id,
      userId: args.userId,
    });

    return attempt ? { attempt, tryout } : null;
  }
);

export interface UserTryoutContext {
  readonly attempt: typeof TryoutAttempts.Doc.Type;
  readonly tryout: typeof Tryouts.Doc.Type;
}
