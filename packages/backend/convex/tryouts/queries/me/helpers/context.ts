import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";

/** Load the latest stored attempt for one user and tryout. */
export async function loadLatestUserTryoutAttempt(
  ctx: QueryCtx,
  {
    tryoutId,
    userId,
  }: {
    tryoutId: Id<"tryouts">;
    userId: Id<"users">;
  }
) {
  return await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryoutId)
    )
    .order("desc")
    .first();
}

/**
 * Load one tryout and resolve the selected attempt when it is valid for the
 * current user and tryout, otherwise fall back to the latest attempt.
 */
export async function loadResolvedUserTryoutContext(
  ctx: QueryCtx,
  {
    attemptId,
    locale,
    product,
    tryoutSlug,
    userId,
  }: {
    attemptId?: string;
    locale: Doc<"tryouts">["locale"];
    product: Doc<"tryouts">["product"];
    tryoutSlug: Doc<"tryouts">["slug"];
    userId: Id<"users">;
  }
) {
  const tryout = await ctx.db
    .query("tryouts")
    .withIndex("by_product_and_locale_and_slug", (q) =>
      q.eq("product", product).eq("locale", locale).eq("slug", tryoutSlug)
    )
    .unique();

  if (!tryout) {
    return null;
  }

  if (!attemptId) {
    const attempt = await loadLatestUserTryoutAttempt(ctx, {
      tryoutId: tryout._id,
      userId,
    });

    if (!attempt) {
      return null;
    }

    return { attempt, tryout };
  }

  const normalizedAttemptId = ctx.db.normalizeId("tryoutAttempts", attemptId);

  if (!normalizedAttemptId) {
    const attempt = await loadLatestUserTryoutAttempt(ctx, {
      tryoutId: tryout._id,
      userId,
    });

    if (!attempt) {
      return null;
    }

    return { attempt, tryout };
  }

  const selectedAttempt = await ctx.db.get(
    "tryoutAttempts",
    normalizedAttemptId
  );

  if (
    selectedAttempt &&
    selectedAttempt.tryoutId === tryout._id &&
    selectedAttempt.userId === userId
  ) {
    return {
      attempt: selectedAttempt,
      tryout,
    };
  }

  const attempt = await loadLatestUserTryoutAttempt(ctx, {
    tryoutId: tryout._id,
    userId,
  });

  if (!attempt) {
    return null;
  }

  return { attempt, tryout };
}

export type ResolvedUserTryoutContext = NonNullable<
  Awaited<ReturnType<typeof loadResolvedUserTryoutContext>>
>;
