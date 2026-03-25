import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";

/** Load one tryout together with the current user's latest attempt for that slug. */
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

  const attempt = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryout._id)
    )
    .order("desc")
    .first();

  if (!attempt) {
    return null;
  }

  return { attempt, tryout };
}
