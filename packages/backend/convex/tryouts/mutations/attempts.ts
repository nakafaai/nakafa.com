import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getActiveTryoutSubscriptionForUserProduct,
  resolveActiveTryoutEventEntitlements,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/access";
import {
  loadPartStartContext,
  loadStartableTryout,
  reuseExistingPartAttempt,
  reuseExistingTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers/attemptLifecycle";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/attempt";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
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
import { getConvexErrorCode } from "@repo/backend/convex/utils/error";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError, v } from "convex/values";

const startTryoutResultValidator = v.union(
  v.object({
    kind: v.literal("started"),
  }),
  v.object({
    kind: v.literal("competition-attempt-used"),
  }),
  v.object({
    kind: v.literal("requires-access"),
  }),
  v.object({
    kind: v.literal("not-ready"),
  }),
  v.object({
    kind: v.literal("not-found"),
  }),
  v.object({
    kind: v.literal("inactive"),
  })
);

const startPartResultValidator = v.union(
  v.object({
    kind: v.literal("started"),
  }),
  v.object({
    kind: v.literal("tryout-expired"),
  }),
  v.object({
    kind: v.literal("part-expired"),
  })
);

const completePartResultValidator = v.union(
  v.object({
    kind: v.literal("completed"),
  }),
  v.object({
    kind: v.literal("tryout-expired"),
  })
);

/** Starts or resumes one authenticated tryout attempt for a product slug. */
export const startTryout = mutation({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlug: v.string(),
  },
  returns: startTryoutResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();
    const startableTryout = await loadStartableTryout(ctx, args).catch(
      (error) => {
        const errorCode = getConvexErrorCode(error);

        if (errorCode === "TRYOUT_NOT_FOUND") {
          logger.warn("Tryout start denied because the tryout was not found", {
            locale: args.locale,
            product: args.product,
            tryoutSlug: args.tryoutSlug,
            userId,
          });

          return { kind: "not-found" as const };
        }

        if (errorCode === "TRYOUT_INACTIVE") {
          logger.warn("Tryout start denied because the tryout is inactive", {
            locale: args.locale,
            product: args.product,
            tryoutSlug: args.tryoutSlug,
            userId,
          });

          return { kind: "inactive" as const };
        }

        throw error;
      }
    );

    if ("kind" in startableTryout) {
      return startableTryout;
    }

    const tryout = startableTryout;

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
      logger.warn("Tryout start denied because scoring is not ready", {
        locale: args.locale,
        product: args.product,
        tryoutId: tryout._id,
        tryoutSlug: tryout.slug,
        userId,
      });

      return { kind: "not-ready" as const };
    }

    if (
      existingAttempt &&
      (await reuseExistingTryoutAttempt(ctx, {
        now,
        userId,
        tryoutAttempt: existingAttempt,
      }))
    ) {
      return { kind: "started" as const };
    }

    const [eventEntitlements, activeSubscription] = await Promise.all([
      resolveActiveTryoutEventEntitlements(ctx.db, {
        now,
        product: tryout.product,
        userId,
      }),
      getActiveTryoutSubscriptionForUserProduct(ctx.db, {
        now,
        product: tryout.product,
        userId,
      }),
    ]);
    const activeCompetitionEntitlement =
      eventEntitlements.competitionEntitlement?.accessCampaignId &&
      eventEntitlements.competitionEntitlement.accessGrantId
        ? eventEntitlements.competitionEntitlement
        : null;
    const activeCompetitionCampaignId =
      activeCompetitionEntitlement?.accessCampaignId ?? null;
    const activeCompetitionGrantId =
      activeCompetitionEntitlement?.accessGrantId ?? null;
    const competitionAttempt = activeCompetitionCampaignId
      ? await ctx.db
          .query("tryoutAttempts")
          .withIndex(
            "by_userId_and_tryoutId_and_accessCampaignId_and_startedAt",
            (q) =>
              q
                .eq("userId", userId)
                .eq("tryoutId", tryout._id)
                .eq("accessCampaignId", activeCompetitionCampaignId)
          )
          .order("desc")
          .first()
      : null;
    const competitionStartSource =
      activeCompetitionEntitlement &&
      activeCompetitionCampaignId &&
      activeCompetitionGrantId &&
      !competitionAttempt
        ? {
            accessKind: "event" as const,
            accessCampaignId: activeCompetitionCampaignId,
            accessCampaignKind: "competition" as const,
            accessEndsAt: activeCompetitionEntitlement.endsAt,
            accessGrantId: activeCompetitionGrantId,
            countsForCompetition: true,
          }
        : null;
    const accessPassEntitlement =
      eventEntitlements.accessPassEntitlement?.accessCampaignId &&
      eventEntitlements.accessPassEntitlement.accessGrantId
        ? eventEntitlements.accessPassEntitlement
        : null;
    const accessPassCampaignId =
      accessPassEntitlement?.accessCampaignId ?? null;
    const accessPassGrantId = accessPassEntitlement?.accessGrantId ?? null;
    const hasUsedCompetitionAttempt = Boolean(competitionAttempt);
    const accessPassStartSource =
      accessPassEntitlement && accessPassCampaignId && accessPassGrantId
        ? {
            accessKind: "event" as const,
            accessCampaignId: accessPassCampaignId,
            accessCampaignKind: "access-pass" as const,
            accessEndsAt: accessPassEntitlement.endsAt,
            accessGrantId: accessPassGrantId,
            countsForCompetition: false,
          }
        : null;
    const subscriptionStartSource = activeSubscription
      ? {
          accessKind: "subscription" as const,
          countsForCompetition: false,
        }
      : null;
    const accessSource =
      competitionStartSource ??
      accessPassStartSource ??
      subscriptionStartSource;

    if (!accessSource) {
      if (hasUsedCompetitionAttempt) {
        logger.warn(
          "Tryout start denied because the counted competition attempt was already used",
          {
            accessCampaignId: activeCompetitionCampaignId ?? undefined,
            locale: args.locale,
            product: args.product,
            tryoutId: tryout._id,
            tryoutSlug: tryout.slug,
            userId,
          }
        );

        return { kind: "competition-attempt-used" as const };
      }

      logger.warn(
        "Tryout start denied because no active access source was found",
        {
          accessPassCampaignId: accessPassCampaignId ?? undefined,
          activeCompetitionCampaignId: activeCompetitionCampaignId ?? undefined,
          locale: args.locale,
          product: args.product,
          tryoutId: tryout._id,
          tryoutSlug: tryout.slug,
          userId,
        }
      );

      return { kind: "requires-access" as const };
    }

    const partSetSnapshots = await loadTryoutPartSnapshots(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });
    const attemptNumber = existingAttempt
      ? existingAttempt.attemptNumber + 1
      : 1;
    const attemptWindowEndsAt =
      now + tryoutProductPolicies[tryout.product].attemptWindowMs;
    const expiresAtMs =
      accessSource.accessKind === "event" &&
      accessSource.accessCampaignKind === "competition"
        ? Math.min(attemptWindowEndsAt, accessSource.accessEndsAt)
        : attemptWindowEndsAt;

    const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
      userId,
      tryoutId: tryout._id,
      scaleVersionId: scaleVersion._id,
      accessKind: accessSource.accessKind,
      accessCampaignId:
        accessSource.accessKind === "event"
          ? accessSource.accessCampaignId
          : undefined,
      accessCampaignKind:
        accessSource.accessKind === "event"
          ? accessSource.accessCampaignKind
          : undefined,
      accessGrantId:
        accessSource.accessKind === "event"
          ? accessSource.accessGrantId
          : undefined,
      accessEndsAt:
        accessSource.accessKind === "event"
          ? accessSource.accessEndsAt
          : undefined,
      countsForCompetition: accessSource.countsForCompetition,
      scoreStatus: scaleVersion.status,
      status: "in-progress",
      partSetSnapshots,
      completedPartIndices: [],
      attemptNumber,
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
      Math.max(0, expiresAtMs - now),
      internal.tryouts.mutations.internal.expiry.expireTryoutAttemptInternal,
      {
        tryoutAttemptId,
        expiresAtMs,
      }
    );

    return { kind: "started" as const };
  },
});

/**
 * Starts or resumes one concrete tryout part looked up by stable part key.
 *
 * Existing attempts stay bound to the persisted snapshot set ID and question
 * count so later content-sync changes cannot rewrite their timer or exercise
 * total.
 */
export const startPart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: startPartResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();
    const partStartContext = await loadPartStartContext(ctx, {
      now,
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    }).catch((error) => {
      if (getConvexErrorCode(error) === "TRYOUT_EXPIRED") {
        logger.warn("Tryout part start denied because the tryout expired", {
          partKey: args.partKey,
          tryoutAttemptId: args.tryoutAttemptId,
          userId,
        });

        return { kind: "tryout-expired" as const };
      }

      throw error;
    });

    if ("kind" in partStartContext) {
      return partStartContext;
    }

    const { tryout, tryoutPartSnapshot } = partStartContext;
    const existingPartAttempt = await reuseExistingPartAttempt(ctx, {
      now,
      partIndex: tryoutPartSnapshot.partIndex,
      tryoutAttemptId: args.tryoutAttemptId,
    }).catch((error) => {
      if (getConvexErrorCode(error) === "TRYOUT_PART_EXPIRED") {
        logger.warn("Tryout part start denied because the part expired", {
          partIndex: tryoutPartSnapshot.partIndex,
          partKey: tryoutPartSnapshot.partKey,
          tryoutAttemptId: args.tryoutAttemptId,
          userId,
        });

        return { kind: "part-expired" as const };
      }

      throw error;
    });

    if (
      typeof existingPartAttempt === "object" &&
      existingPartAttempt !== null
    ) {
      return existingPartAttempt;
    }

    if (existingPartAttempt) {
      return { kind: "started" as const };
    }

    const set = await ctx.db.get("exerciseSets", tryoutPartSnapshot.setId);

    if (!set) {
      throw new ConvexError({
        code: "SET_NOT_FOUND",
        message: "Exercise set not found.",
      });
    }

    const questionCount = tryoutPartSnapshot.questionCount;
    const timeLimit =
      tryoutProductPolicies[tryout.product].getPartTimeLimitSeconds(
        questionCount
      );

    const setAttemptId = await createExerciseAttempt(ctx, {
      slug: set.slug,
      userId,
      origin: "tryout",
      mode: "simulation",
      scope: "set",
      timeLimit,
      startedAt: now,
      totalExercises: questionCount,
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

    return { kind: "started" as const };
  },
});

/** Finalizes one part identified by stable part key and updates totals. */
export const completePart = mutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    partKey: tryoutPartKeyValidator,
  },
  returns: completePartResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;
    const now = Date.now();
    const currentTryoutAttempt = await requireOwnedTryoutAttempt(ctx, {
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    })
      .then((tryoutAttempt) =>
        requireActiveTryoutAttemptAfterExpirySync(ctx, {
          now,
          tryoutAttempt,
        })
      )
      .catch((error) => {
        if (getConvexErrorCode(error) === "TRYOUT_EXPIRED") {
          logger.warn(
            "Tryout part completion denied because the tryout expired",
            {
              partKey: args.partKey,
              tryoutAttemptId: args.tryoutAttemptId,
              userId,
            }
          );

          return { kind: "tryout-expired" as const };
        }

        throw error;
      });

    if ("kind" in currentTryoutAttempt) {
      return currentTryoutAttempt;
    }

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

    const partAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
        q
          .eq("tryoutAttemptId", args.tryoutAttemptId)
          .eq("partIndex", resolvedPart.snapshot.partIndex)
      )
      .unique();

    if (!partAttempt) {
      throw new ConvexError({
        code: "PART_ATTEMPT_NOT_FOUND",
        message: "Tryout part attempt not found.",
      });
    }

    if (
      currentTryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)
    ) {
      return { kind: "completed" as const };
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

    return { kind: "completed" as const };
  },
});
