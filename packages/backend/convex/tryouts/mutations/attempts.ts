import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
  requireTryoutPartAttempt,
} from "@repo/backend/convex/tryouts/helpers/access";
import { syncTryoutAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import {
  finalizeTryoutPartAttempt,
  getFirstIncompleteTryoutPartIndex,
} from "@repo/backend/convex/tryouts/helpers/scoring";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/mutations/helpers";
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

    if (existingAttempt) {
      const tryoutExpiry = await syncTryoutAttemptExpiry(
        ctx,
        existingAttempt,
        now
      );

      if (!tryoutExpiry.expired && existingAttempt.status === "in-progress") {
        const firstIncompletePartIndex = getFirstIncompleteTryoutPartIndex({
          completedPartIndices: existingAttempt.completedPartIndices,
          partCount: tryout.partCount,
        });

        if (firstIncompletePartIndex === undefined) {
          const completedAttempt = await finalizeTryoutAttempt({
            ctx,
            now,
            tryoutAttempt: existingAttempt,
            userId,
          });

          if (completedAttempt.status !== "completed") {
            throw new ConvexError({
              code: "INVALID_TRYOUT_STATE",
              message:
                "Tryout has no incomplete part but could not be finalized.",
            });
          }

          return null;
        }

        return null;
      }
    }

    await loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });

    const expiresAtMs =
      now + tryoutProductPolicies[tryout.product].getAttemptWindowMs();

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

    const tryoutAttempt = await requireOwnedTryoutAttempt(ctx, {
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    });

    const activeTryoutAttempt = await requireActiveTryoutAttemptAfterExpirySync(
      ctx,
      {
        now,
        tryoutAttempt,
      }
    );
    const tryout = await ctx.db.get("tryouts", activeTryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const tryoutPartSet = await ctx.db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partKey", (q) =>
        q.eq("tryoutId", tryoutAttempt.tryoutId).eq("partKey", args.partKey)
      )
      .unique();

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

    const existingPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
        q
          .eq("tryoutAttemptId", args.tryoutAttemptId)
          .eq("partKey", args.partKey)
      )
      .unique();

    if (existingPartAttempt) {
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

      if (existingSetAttempt.status === "in-progress") {
        const expiresAtMs =
          existingSetAttempt.startedAt + existingSetAttempt.timeLimit * 1000;

        if (now >= expiresAtMs) {
          await finalizeTryoutPartAttempt({
            ctx,
            finishedAtMs: expiresAtMs,
            now,
            partAttempt: existingPartAttempt,
            status: "expired",
            tryoutAttemptId: args.tryoutAttemptId,
          });

          throw new ConvexError({
            code: "TRYOUT_PART_EXPIRED",
            message: "This tryout part has already expired.",
          });
        }

        return null;
      }

      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part state is out of sync with its tryout attempt.",
      });
    }

    const set = await ctx.db.get("exerciseSets", tryoutPartSet.setId);

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

    const partAttempt = await requireTryoutPartAttempt(ctx, {
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
