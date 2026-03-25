import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

/**
 * Load one tryout, its latest projected attempt row, and the backing attempt
 * document for the current user.
 *
 * This is the single source of truth for user-facing `me/*` tryout reads.
 * If the latest-attempt projection points at a missing attempt document, we
 * fail loudly instead of silently hiding corrupted state.
 */
export async function loadLatestUserTryoutContext(
  ctx: QueryCtx,
  {
    locale,
    product,
    tryoutSlug,
    userId,
  }: {
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

  const latestAttempt = await ctx.db
    .query("userTryoutLatestAttempts")
    .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
      q
        .eq("userId", userId)
        .eq("product", product)
        .eq("locale", locale)
        .eq("tryoutId", tryout._id)
    )
    .unique();

  if (!latestAttempt) {
    return null;
  }

  const attempt = await ctx.db.get("tryoutAttempts", latestAttempt.attemptId);

  if (!attempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Latest tryout attempt projection points to a missing attempt.",
    });
  }

  return { attempt, tryout };
}
