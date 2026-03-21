import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import {
  getLatestScaleVersionForTryout,
  getScaleVersionStatus,
} from "@repo/backend/convex/irt/scaleVersions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  finalizeTryoutPartAttempt,
  getFirstIncompleteTryoutPartIndex,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/mutations/helpers";
import {
  computeTryoutExpiresAtMs,
  computeTryoutPartTimeLimitSeconds,
  scaleThetaToTryoutScore,
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
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryout = await ctx.db
      .query("tryouts")
      .withIndex("product_locale_slug", (q) =>
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
        .withIndex("userId_tryoutId_startedAt", (q) =>
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

    const firstPart = await ctx.db
      .query("tryoutPartSets")
      .withIndex("tryoutId_partIndex", (q) =>
        q.eq("tryoutId", tryout._id).eq("partIndex", 0)
      )
      .unique();

    if (!firstPart) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout is missing its first part.",
      });
    }

    const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
      userId,
      tryoutId: tryout._id,
      scaleVersionId: scaleVersion._id,
      scoreStatus: getScaleVersionStatus(scaleVersion),
      status: "in-progress",
      completedPartIndices: [],
      totalCorrect: 0,
      totalQuestions: 0,
      theta: 0,
      thetaSE: 1,
      irtScore: scaleThetaToTryoutScore({ product: tryout.product, theta: 0 }),
      startedAt: now,
      lastActivityAt: now,
      completedAt: null,
      endReason: null,
    });

    const expiresAtMs = computeTryoutExpiresAtMs({
      product: tryout.product,
      startedAtMs: now,
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
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (!tryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    if (tryoutAttempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this tryout attempt.",
      });
    }

    const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

    if (tryoutExpiry.expired) {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
        expiresAtMs: tryoutExpiry.expiredAtMs,
      });
    }

    if (tryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      });
    }

    const tryoutPartSet = await ctx.db
      .query("tryoutPartSets")
      .withIndex("tryoutId_partKey", (q) =>
        q.eq("tryoutId", tryoutAttempt.tryoutId).eq("partKey", args.partKey)
      )
      .unique();

    if (!tryoutPartSet) {
      throw new ConvexError({
        code: "PART_NOT_FOUND",
        message: "Tryout part not found.",
      });
    }

    if (tryoutAttempt.completedPartIndices.includes(tryoutPartSet.partIndex)) {
      throw new ConvexError({
        code: "PART_ALREADY_COMPLETED",
        message: "This tryout part has already been completed.",
      });
    }

    const set = await ctx.db.get("exerciseSets", tryoutPartSet.setId);

    if (!set) {
      throw new ConvexError({
        code: "SET_NOT_FOUND",
        message: "Exercise set not found.",
      });
    }

    const existingPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("tryoutAttemptId_partKey", (q) =>
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

    if (set.questionCount <= 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "questionCount must be greater than 0.",
      });
    }

    const timeLimit = computeTryoutPartTimeLimitSeconds({
      product: tryout.product,
      questionCount: set.questionCount,
    });

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
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (!tryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    if (tryoutAttempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this tryout attempt.",
      });
    }

    await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

    const currentTryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (!currentTryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    const tryout = await ctx.db.get("tryouts", currentTryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const partAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("tryoutAttemptId_partKey", (q) =>
        q
          .eq("tryoutAttemptId", args.tryoutAttemptId)
          .eq("partKey", args.partKey)
      )
      .unique();

    if (!partAttempt) {
      throw new ConvexError({
        code: "PART_ATTEMPT_NOT_FOUND",
        message: "Tryout part attempt not found.",
      });
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      partAttempt.setAttemptId
    );

    if (!setAttempt) {
      throw new ConvexError({
        code: "SET_ATTEMPT_NOT_FOUND",
        message: "Exercise set attempt not found.",
      });
    }

    if (
      currentTryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)
    ) {
      return null;
    }

    if (currentTryoutAttempt.status === "expired") {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
        expiresAtMs: computeTryoutExpiresAtMs({
          product: tryout.product,
          startedAtMs: currentTryoutAttempt.startedAt,
        }),
      });
    }

    if (currentTryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      });
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
