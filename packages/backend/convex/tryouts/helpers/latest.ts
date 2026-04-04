import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

type TryoutLatestAttemptWriter = Pick<MutationCtx, "db">;

/**
 * Keep the small per-user hub badge summary aligned with the latest runtime
 * attempt projection. The hub only needs badge state, not full attempt docs.
 */
export async function upsertUserTryoutCatalogStatuses(
  ctx: TryoutLatestAttemptWriter,
  {
    attempt,
    tryout,
    updatedAt,
  }: {
    attempt: Pick<Doc<"tryoutAttempts">, "expiresAt" | "status" | "userId">;
    tryout: Pick<Doc<"tryouts">, "locale" | "product" | "slug">;
    updatedAt: number;
  }
) {
  const existing = await ctx.db
    .query("userTryoutCatalogStatuses")
    .withIndex("by_userId_and_product_and_locale", (q) =>
      q
        .eq("userId", attempt.userId)
        .eq("product", tryout.product)
        .eq("locale", tryout.locale)
    )
    .unique();
  const nextStatus = {
    expiresAtMs: attempt.expiresAt,
    status: attempt.status,
    updatedAt,
  };

  if (!existing) {
    await ctx.db.insert("userTryoutCatalogStatuses", {
      locale: tryout.locale,
      product: tryout.product,
      statusesBySlug: {
        [tryout.slug]: nextStatus,
      },
      updatedAt,
      userId: attempt.userId,
    });
    return;
  }

  const currentStatus = existing.statusesBySlug[tryout.slug] ?? null;

  if (currentStatus && currentStatus.updatedAt > nextStatus.updatedAt) {
    return;
  }

  if (
    currentStatus?.updatedAt === nextStatus.updatedAt &&
    currentStatus?.status === nextStatus.status &&
    currentStatus.expiresAtMs === nextStatus.expiresAtMs
  ) {
    return;
  }

  await ctx.db.patch("userTryoutCatalogStatuses", existing._id, {
    statusesBySlug: {
      ...existing.statusesBySlug,
      [tryout.slug]: nextStatus,
    },
    updatedAt,
  });
}

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

  await upsertUserTryoutCatalogStatuses(ctx, {
    attempt,
    tryout,
    updatedAt,
  });
}
