import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { hasTryoutAccessNow } from "@repo/backend/convex/tryoutAccess/helpers/access";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/access";
import {
  loadPartStartContext,
  loadStartableSet,
  loadStartableTryout,
  loadTryoutPartAttempt,
  reuseExistingPartAttempt,
  reuseExistingTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/attemptLifecycle";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/attempt";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
import { upsertUserTryoutLatestAttempt } from "@repo/backend/convex/tryouts/helpers/latest";
import {
  loadTryoutPartSnapshots,
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/convex/tryouts/helpers/parts";
import {
  tryoutProductPolicies,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

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
        userId,
        tryoutAttempt: existingAttempt,
      }))
    ) {
      return null;
    }

    const canStartTryout = await hasTryoutAccessNow(ctx.db, {
      now,
      product: tryout.product,
      userId,
    });

    if (!canStartTryout) {
      throw new ConvexError({
        code: "TRYOUT_ACCESS_REQUIRED",
        message:
          "You need an active event access or Pro subscription to start this tryout.",
      });
    }

    const partSetSnapshots = await loadTryoutPartSnapshots(ctx.db, {
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
      partSetSnapshots,
      completedPartIndices: [],
      totalCorrect: 0,
      totalQuestions: 0,
      theta: 0,
      thetaSE: 1,
      startedAt: now,
      expiresAt: expiresAtMs,
      lastActivityAt: now,
      completedAt: null,
      endReason: null,
    });

    await ctx.scheduler.runAfter(
      expiresAtMs - now,
      internal.tryouts.mutations.internal.expiry.expireTryoutAttemptInternal,
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
    const { tryout, tryoutPartSnapshot } = await loadPartStartContext(ctx, {
      now,
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    });

    if (
      await reuseExistingPartAttempt(ctx, {
        now,
        partIndex: tryoutPartSnapshot.partIndex,
        tryoutAttemptId: args.tryoutAttemptId,
      })
    ) {
      return null;
    }

    const set = await loadStartableSet(ctx, tryoutPartSnapshot.setId);

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
      partIndex: tryoutPartSnapshot.partIndex,
      partKey: tryoutPartSnapshot.partKey,
      setAttemptId,
      setId: tryoutPartSnapshot.setId,
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
    const tryout = await ctx.db.get("tryouts", currentTryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const currentPartSets = await loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });
    const resolvedPart = resolveRequestedTryoutPart({
      currentPartSets,
      partSetSnapshots: currentTryoutAttempt.partSetSnapshots,
      requestedPartKey: args.partKey,
    });

    if (!resolvedPart) {
      throw new ConvexError({
        code: "PART_ATTEMPT_NOT_FOUND",
        message: "Tryout part attempt not found.",
      });
    }

    const partAttempt = await loadTryoutPartAttempt(ctx, {
      partIndex: resolvedPart.snapshot.partIndex,
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
