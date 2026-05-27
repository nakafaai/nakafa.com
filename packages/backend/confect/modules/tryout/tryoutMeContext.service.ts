import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { Effect } from "effect";

/** Loads the newest attempt for a user and tryout. */
export const loadLatestUserTryoutAttempt = Effect.fn(
  "tryouts.me.loadLatestUserTryoutAttempt"
)(function* (
  ctx: ConvexQueryCtx,
  args: { readonly tryoutId: Id<"tryouts">; readonly userId: Id<"users"> }
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutId_and_startedAt", (query) =>
        query.eq("userId", args.userId).eq("tryoutId", args.tryoutId)
      )
      .order("desc")
      .first()
  );
});

/** Resolves a route and optional attempt id to the user's visible attempt. */
export const loadResolvedUserTryoutContext = Effect.fn(
  "tryouts.me.loadResolvedUserTryoutContext"
)(function* (
  ctx: ConvexQueryCtx,
  args: {
    readonly attemptId?: string;
    readonly locale: "en" | "id";
    readonly product: TryoutProduct;
    readonly tryoutSlug: string;
    readonly userId: Id<"users">;
  }
) {
  const tryout = yield* Effect.promise(() =>
    ctx.db
      .query("tryouts")
      .withIndex("by_product_and_locale_and_slug", (query) =>
        query
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("slug", args.tryoutSlug)
      )
      .unique()
  );

  if (!tryout) {
    return null;
  }

  if (!args.attemptId) {
    const attempt = yield* loadLatestUserTryoutAttempt(ctx, {
      tryoutId: tryout._id,
      userId: args.userId,
    });
    return attempt ? { attempt, tryout } : null;
  }

  const normalizedAttemptId = ctx.db.normalizeId(
    "tryoutAttempts",
    args.attemptId
  );

  if (!normalizedAttemptId) {
    const attempt = yield* loadLatestUserTryoutAttempt(ctx, {
      tryoutId: tryout._id,
      userId: args.userId,
    });
    return attempt ? { attempt, tryout } : null;
  }

  const selectedAttempt = yield* Effect.promise(() =>
    ctx.db.get(normalizedAttemptId)
  );

  if (
    selectedAttempt &&
    selectedAttempt.tryoutId === tryout._id &&
    selectedAttempt.userId === args.userId
  ) {
    return { attempt: selectedAttempt, tryout };
  }

  const attempt = yield* loadLatestUserTryoutAttempt(ctx, {
    tryoutId: tryout._id,
    userId: args.userId,
  });

  return attempt ? { attempt, tryout } : null;
});

export interface UserTryoutContext {
  readonly attempt: Doc<"tryoutAttempts">;
  readonly tryout: Doc<"tryouts">;
}
