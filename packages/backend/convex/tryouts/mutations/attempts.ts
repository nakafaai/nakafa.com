import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { computeAttemptDurationSeconds } from "@repo/backend/convex/exercises/utils";
import { mutation } from "@repo/backend/convex/functions";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import {
  getLatestScaleVersionForTryout,
  getScaleVersionItemsForSet,
} from "@repo/backend/convex/irt/scaleVersions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  buildIrtResponses,
  countCorrectAnswers,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers";
import {
  completeTryoutResultValidator,
  finalizeTryoutAttempt,
} from "@repo/backend/convex/tryouts/mutations/helpers";
import {
  computeTryoutExpiresAtMs,
  computeTryoutPartTimeLimitSeconds,
  scaleThetaToTryoutScore,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";
import { literals } from "convex-helpers/validators";

const startTryoutStatusValidator = literals("in-progress", "completed");

const startTryoutResultValidator = v.object({
  tryoutAttemptId: vv.id("tryoutAttempts"),
  partCount: v.number(),
  firstPartKey: v.optional(tryoutPartKeyValidator),
  expiresAtMs: v.number(),
  status: startTryoutStatusValidator,
});

/** Starts or resumes one authenticated tryout attempt for a product slug. */
export const startTryout = mutation({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlug: v.string(),
  },
  returns: startTryoutResultValidator,
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
        const tryoutPartSets = await getManyFrom(
          ctx.db,
          "tryoutPartSets",
          "tryoutId_partIndex",
          tryout._id,
          "tryoutId"
        );

        const firstIncompletePart = tryoutPartSets.find(
          (partSet) =>
            !existingAttempt.completedPartIndices.includes(partSet.partIndex)
        );

        if (!firstIncompletePart) {
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

          return {
            tryoutAttemptId: existingAttempt._id,
            partCount: tryout.partCount,
            firstPartKey: undefined,
            expiresAtMs: tryoutExpiry.expiredAtMs,
            status: completedAttempt.status,
          } satisfies Infer<typeof startTryoutResultValidator>;
        }

        return {
          tryoutAttemptId: existingAttempt._id,
          partCount: tryout.partCount,
          firstPartKey: firstIncompletePart.partKey,
          expiresAtMs: tryoutExpiry.expiredAtMs,
          status: "in-progress",
        } satisfies Infer<typeof startTryoutResultValidator>;
      }
    }

    const tryoutPartSets = await getManyFrom(
      ctx.db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryout._id,
      "tryoutId"
    );
    const firstPart = tryoutPartSets[0];

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
      status: "in-progress",
      completedPartIndices: [],
      totalCorrect: 0,
      totalQuestions: 0,
      theta: 0,
      thetaSE: 1,
      irtScore: scaleThetaToTryoutScore({ product: tryout.product, theta: 0 }),
      startedAt: now,
      lastActivityAt: now,
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

    return {
      tryoutAttemptId,
      partCount: tryout.partCount,
      firstPartKey: firstPart.partKey,
      expiresAtMs,
      status: "in-progress",
    } satisfies Infer<typeof startTryoutResultValidator>;
  },
});

/** Starts or resumes one concrete tryout part looked up by stable part key. */
export const startPart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: v.object({
    setAttemptId: vv.id("exerciseAttempts"),
    setId: vv.id("exerciseSets"),
    questionCount: v.number(),
  }),
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

      return {
        setAttemptId: existingPartAttempt.setAttemptId,
        setId: tryoutPartSet.setId,
        questionCount: set.questionCount,
      };
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

    return {
      setAttemptId,
      setId: tryoutPartSet.setId,
      questionCount: set.questionCount,
    };
  },
});

/** Finalizes one part identified by stable part key and updates totals. */
export const completePart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: v.object({
    theta: v.number(),
    thetaSE: v.number(),
    rawScore: v.number(),
    totalQuestions: v.number(),
  }),
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

    if (tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)) {
      const answers = await ctx.db
        .query("exerciseAnswers")
        .withIndex("attemptId_exerciseNumber", (q) =>
          q.eq("attemptId", partAttempt.setAttemptId)
        )
        .collect();

      return {
        theta: partAttempt.theta,
        thetaSE: partAttempt.thetaSE,
        rawScore: countCorrectAnswers(answers),
        totalQuestions: setAttempt.totalExercises,
      };
    }

    if (setAttempt.status !== "completed" && setAttempt.status !== "expired") {
      if (setAttempt.schedulerId) {
        await ctx.scheduler.cancel(setAttempt.schedulerId);
      }

      const expiresAtMs = setAttempt.startedAt + setAttempt.timeLimit * 1000;
      const completedAtMs = Math.min(now, expiresAtMs);
      const finalStatus = now >= expiresAtMs ? "expired" : "completed";
      const totalTime = computeAttemptDurationSeconds({
        startedAtMs: setAttempt.startedAt,
        completedAtMs,
      });

      await ctx.db.patch("exerciseAttempts", partAttempt.setAttemptId, {
        status: finalStatus,
        completedAt: completedAtMs,
        lastActivityAt: now,
        updatedAt: now,
        totalTime,
      });
    }

    const answers = await ctx.db
      .query("exerciseAnswers")
      .withIndex("attemptId_exerciseNumber", (q) =>
        q.eq("attemptId", partAttempt.setAttemptId)
      )
      .collect();
    const itemParamsRecords = await getScaleVersionItemsForSet(ctx.db, {
      scaleVersionId: tryoutAttempt.scaleVersionId,
      setId: partAttempt.setId,
    });
    const itemResponses = buildIrtResponses({ answers, itemParamsRecords });
    const { theta, se } = estimateThetaEAP(itemResponses);
    const rawScore = countCorrectAnswers(answers);

    await ctx.db.patch("tryoutPartAttempts", partAttempt._id, {
      theta,
      thetaSE: se,
    });

    const totalCorrect = tryoutAttempt.totalCorrect + rawScore;
    const totalQuestions =
      tryoutAttempt.totalQuestions + setAttempt.totalExercises;
    const completedPartIndices = [
      ...tryoutAttempt.completedPartIndices,
      partAttempt.partIndex,
    ];

    await ctx.db.patch("tryoutAttempts", args.tryoutAttemptId, {
      completedPartIndices,
      totalCorrect,
      totalQuestions,
      lastActivityAt: now,
    });

    await ctx.db.insert("irtCalibrationQueue", {
      setId: partAttempt.setId,
      enqueuedAt: now,
    });

    return {
      theta,
      thetaSE: se,
      rawScore,
      totalQuestions: setAttempt.totalExercises,
    };
  },
});

/** Finalizes the full tryout and publishes leaderboard state when official. */
export const completeTryout = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
  },
  returns: completeTryoutResultValidator,
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

    return finalizeTryoutAttempt({
      ctx,
      now,
      tryoutAttempt,
      userId,
    });
  },
});
