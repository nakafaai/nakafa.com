import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

type TryoutLatestAttemptWriter = Pick<MutationCtx, "db">;

/** Upsert the latest user-visible tryout attempt status for one tryout. */
export async function upsertUserTryoutLatestAttempt(
  ctx: TryoutLatestAttemptWriter,
  {
    attempt,
    tryout,
    updatedAt,
  }: {
    attempt: Pick<
      Doc<"tryoutAttempts">,
      "_id" | "expiresAt" | "status" | "tryoutId" | "userId"
    >;
    tryout: Pick<Doc<"tryouts">, "_id" | "locale" | "product" | "slug">;
    updatedAt: number;
  }
) {
  const existing = await ctx.db
    .query("userTryoutLatestAttempts")
    .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
      q
        .eq("userId", attempt.userId)
        .eq("product", tryout.product)
        .eq("locale", tryout.locale)
        .eq("tryoutId", tryout._id)
    )
    .unique();

  const nextValue = {
    attemptId: attempt._id,
    expiresAtMs: attempt.expiresAt,
    locale: tryout.locale,
    product: tryout.product,
    slug: tryout.slug,
    status: attempt.status,
    tryoutId: tryout._id,
    updatedAt,
    userId: attempt.userId,
  };

  if (existing) {
    await ctx.db.patch("userTryoutLatestAttempts", existing._id, nextValue);
  } else {
    await ctx.db.insert("userTryoutLatestAttempts", nextValue);
  }
}
