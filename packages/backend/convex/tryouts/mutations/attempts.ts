import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { mutation } from "@repo/backend/convex/functions";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { resolveTryoutAccessEntitlements } from "@repo/backend/convex/tryoutAccess/helpers/access";
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
import { loadOrCreateUserTryoutControl } from "@repo/backend/convex/tryouts/helpers/control";
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
    const tryoutControl = await loadOrCreateUserTryoutControl(ctx.db, {
      updatedAt: now,
      userId,
    });

    if (!tryoutControl) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout control is missing for this user.",
      });
    }

    await ctx.db.patch("userTryoutControls", tryoutControl._id, {
      updatedAt: now,
    });

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

    const accessEntitlements = await resolveTryoutAccessEntitlements(ctx.db, {
      product: tryout.product,
      userId,
    });
    const activeCompetitionEntitlement =
      accessEntitlements.competitionEntitlement?.accessCampaignId &&
      accessEntitlements.competitionEntitlement.accessGrantId &&
      accessEntitlements.competitionEntitlement.endsAt > now
        ? accessEntitlements.competitionEntitlement
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
      accessEntitlements.accessPassEntitlement?.accessCampaignId &&
      accessEntitlements.accessPassEntitlement.accessGrantId &&
      accessEntitlements.accessPassEntitlement.endsAt > now
        ? accessEntitlements.accessPassEntitlement
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
    const subscriptionStartSource =
      accessEntitlements.subscriptionEntitlement &&
      accessEntitlements.subscriptionEntitlement.endsAt > now
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
        throw new ConvexError({
          code: "COMPETITION_ATTEMPT_ALREADY_USED",
          message:
            "This event only counts your first tryout attempt. You can still review that result anytime.",
        });
      }

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

    return null;
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
