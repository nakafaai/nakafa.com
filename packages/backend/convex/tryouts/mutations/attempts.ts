import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/access";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/metrics";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/mutations/helpers";
import {
  tryoutProductPolicies,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

async function loadStartableTryout(
  ctx: MutationCtx,
  args: {
    locale: Doc<"tryouts">["locale"];
    product: Doc<"tryouts">["product"];
    tryoutSlug: Doc<"tryouts">["slug"];
  }
) {
  const tryout = await ctx.db
    .query("tryouts")
    .withIndex("by_product_and_locale_and_slug", (q) =>
      q
        .eq("product", args.product)
        .eq("locale", args.locale)
        .eq("slug", args.tryoutSlug)
    )
    .unique();

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  if (!tryout.isActive) {
    throw new ConvexError({
      code: "TRYOUT_INACTIVE",
      message: "This tryout is not currently active.",
    });
  }

  return tryout;
}

async function reuseExistingTryoutAttempt(
  ctx: MutationCtx,
  {
    now,
    tryout,
    userId,
    tryoutAttempt,
  }: {
    now: number;
    tryout: Doc<"tryouts">;
    userId: Doc<"users">["_id"];
    tryoutAttempt: Doc<"tryoutAttempts">;
  }
) {
  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (tryoutExpiry.expired || tryoutAttempt.status !== "in-progress") {
    return false;
  }

  const firstIncompletePartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices: tryoutAttempt.completedPartIndices,
    partCount: tryout.partCount,
  });

  if (firstIncompletePartIndex !== undefined) {
    return true;
  }

  const completedAttempt = await finalizeTryoutAttempt({
    ctx,
    now,
    tryoutAttempt,
    userId,
  });

  if (completedAttempt.status !== "completed") {
    throw new ConvexError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout has no incomplete part but could not be finalized.",
    });
  }

  return true;
}

async function loadPartStartContext(
  ctx: MutationCtx,
  {
    now,
    partKey,
    tryoutAttemptId,
    userId,
  }: {
    now: number;
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
    userId: Doc<"users">["_id"];
  }
) {
  const tryoutAttempt = await requireOwnedTryoutAttempt(ctx, {
    tryoutAttemptId,
    userId,
  });
  const activeTryoutAttempt = await requireActiveTryoutAttemptAfterExpirySync(
    ctx,
    {
      now,
      tryoutAttempt,
    }
  );
  const [tryout, tryoutPartSet] = await Promise.all([
    ctx.db.get("tryouts", activeTryoutAttempt.tryoutId),
    ctx.db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partKey", (q) =>
        q.eq("tryoutId", tryoutAttempt.tryoutId).eq("partKey", partKey)
      )
      .unique(),
  ]);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  if (!tryoutPartSet) {
    throw new ConvexError({
      code: "PART_NOT_FOUND",
      message: "Tryout part not found.",
    });
  }

  if (
    activeTryoutAttempt.completedPartIndices.includes(tryoutPartSet.partIndex)
  ) {
    throw new ConvexError({
      code: "PART_ALREADY_COMPLETED",
      message: "This tryout part has already been completed.",
    });
  }

  return {
    tryout,
    tryoutPartSet,
  };
}

async function reuseExistingPartAttempt(
  ctx: MutationCtx,
  {
    now,
    partKey,
    tryoutAttemptId,
  }: {
    now: number;
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
  }
) {
  const existingPartAttempt = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId).eq("partKey", partKey)
    )
    .unique();

  if (!existingPartAttempt) {
    return false;
  }

  const existingSetAttempt = await ctx.db.get(
    "exerciseAttempts",
    existingPartAttempt.setAttemptId
  );

  if (!existingSetAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout part attempt exists without its exercise attempt.",
    });
  }

  if (existingSetAttempt.status !== "in-progress") {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout part state is out of sync with its tryout attempt.",
    });
  }

  const expiresAtMs =
    existingSetAttempt.startedAt + existingSetAttempt.timeLimit * 1000;

  if (now < expiresAtMs) {
    return true;
  }

  await finalizeTryoutPartAttempt({
    ctx,
    finishedAtMs: expiresAtMs,
    now,
    partAttempt: existingPartAttempt,
    status: "expired",
    tryoutAttemptId,
  });

  throw new ConvexError({
    code: "TRYOUT_PART_EXPIRED",
    message: "This tryout part has already expired.",
  });
}

async function loadStartableSet(
  ctx: MutationCtx,
  setId: Doc<"exerciseSets">["_id"]
) {
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new ConvexError({
      code: "SET_NOT_FOUND",
      message: "Exercise set not found.",
    });
  }

  if (set.questionCount <= 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "questionCount must be greater than 0.",
    });
  }

  return set;
}

async function loadTryoutPartAttempt(
  ctx: MutationCtx,
  {
    partKey,
    tryoutAttemptId,
  }: {
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    tryoutAttemptId: Doc<"tryoutAttempts">["_id"];
  }
) {
  const partAttempt = await ctx.db
    .query("tryoutPartAttempts")
    .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
      q.eq("tryoutAttemptId", tryoutAttemptId).eq("partKey", partKey)
    )
    .unique();

  if (!partAttempt) {
    throw new ConvexError({
      code: "PART_ATTEMPT_NOT_FOUND",
      message: "Tryout part attempt not found.",
    });
  }

  return partAttempt;
}

/** Starts or resumes one authenticated tryout attempt for a product slug. */
export const startTryout = mutation({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlug: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();
    const tryout = await loadStartableTryout(ctx, args);

    const [scaleVersion, existingAttempt] = await Promise.all([
      getLatestScaleVersionForTryout(ctx.db, tryout._id),
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", userId).eq("tryoutId", tryout._id)
        )
        .order("desc")
        .first(),
    ]);

    if (!scaleVersion) {
      throw new ConvexError({
        code: "TRYOUT_NOT_READY",
        message: "This tryout is not ready for official scoring yet.",
      });
    }

    if (
      existingAttempt &&
      (await reuseExistingTryoutAttempt(ctx, {
        now,
        tryout,
        userId,
        tryoutAttempt: existingAttempt,
      }))
    ) {
      return null;
    }

    await loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });

    const expiresAtMs =
      now + tryoutProductPolicies[tryout.product].attemptWindowMs;

    const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
      userId,
      tryoutId: tryout._id,
      scaleVersionId: scaleVersion._id,
      scoreStatus: scaleVersion.status,
      status: "in-progress",
      completedPartIndices: [],
      totalCorrect: 0,
      totalQuestions: 0,
      theta: 0,
      thetaSE: 1,
      irtScore: tryoutProductPolicies[tryout.product].scaleThetaToScore(0),
      startedAt: now,
      expiresAt: expiresAtMs,
      lastActivityAt: now,
      completedAt: null,
      endReason: null,
    });

    await ctx.scheduler.runAfter(
      expiresAtMs - now,
      internal.tryouts.internalMutations.expireTryoutAttemptInternal,
      {
        tryoutAttemptId,
        expiresAtMs,
      }
    );

    await upsertUserTryoutLatestAttempt(ctx, {
      attempt: {
        _id: tryoutAttemptId,
        expiresAt: expiresAtMs,
        status: "in-progress",
        tryoutId: tryout._id,
        userId,
      },
      tryout,
      updatedAt: now,
    });

    return null;
  },
});

/** Starts or resumes one concrete tryout part looked up by stable part key. */
export const startPart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();
    const { tryout, tryoutPartSet } = await loadPartStartContext(ctx, {
      now,
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    });

    if (
      await reuseExistingPartAttempt(ctx, {
        now,
        partKey: args.partKey,
        tryoutAttemptId: args.tryoutAttemptId,
      })
    ) {
      return null;
    }

    const set = await loadStartableSet(ctx, tryoutPartSet.setId);

    const timeLimit = tryoutProductPolicies[
      tryout.product
    ].getPartTimeLimitSeconds(set.questionCount);

    const setAttemptId = await createExerciseAttempt(ctx, {
      slug: set.slug,
      userId,
      origin: "tryout",
      mode: "simulation",
      scope: "set",
      timeLimit,
      startedAt: now,
      totalExercises: set.questionCount,
    });

    await ctx.db.insert("tryoutPartAttempts", {
      tryoutAttemptId: args.tryoutAttemptId,
      partIndex: tryoutPartSet.partIndex,
      partKey: tryoutPartSet.partKey,
      setAttemptId,
      setId: tryoutPartSet.setId,
      theta: 0,
      thetaSE: 1,
    });

    await ctx.db.patch("tryoutAttempts", args.tryoutAttemptId, {
      lastActivityAt: now,
    });

    return null;
  },
});

/** Finalizes one part identified by stable part key and updates totals. */
export const completePart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryoutAttempt = await requireOwnedTryoutAttempt(ctx, {
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    });
    const currentTryoutAttempt =
      await requireActiveTryoutAttemptAfterExpirySync(ctx, {
        now,
        tryoutAttempt,
      });

    const partAttempt = await loadTryoutPartAttempt(ctx, {
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
    });

    if (
      currentTryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)
    ) {
      return null;
    }

    await finalizeTryoutPartAttempt({
      ctx,
      finishedAtMs: now,
      now,
      partAttempt,
      status: "completed",
      tryoutAttemptId: args.tryoutAttemptId,
    });

    const refreshedTryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (!refreshedTryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    await finalizeTryoutAttempt({
      ctx,
      now,
      tryoutAttempt: refreshedTryoutAttempt,
      userId,
    });

    return null;
  },
});
