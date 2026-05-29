import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { createExerciseAttempt } from "@repo/backend/confect/modules/learning/exercises/attempts.service";
import { getLatestScaleVersionForTryout } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { resolveActiveTryoutEventEntitlements } from "@repo/backend/confect/modules/tryout/tryoutAccessEntitlements.service";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/confect/modules/tryout/tryoutAttemptAccess.service";
import {
  loadPartStartContext,
  loadStartableTryout,
  reuseExistingPartAttempt,
  reuseExistingTryoutAttempt,
} from "@repo/backend/confect/modules/tryout/tryoutAttemptLifecycle.service";
import { finalizeTryoutAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAttempt.service";
import { finalizeTryoutPartAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizePart.service";
import {
  loadTryoutPartSnapshots,
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { getActiveTryoutSubscriptionForUserProduct } from "@repo/backend/confect/modules/tryout/tryoutSubscriptions.service";
import { Clock, Duration, Effect, Either, Option } from "effect";

/** Starts or resumes the current user's tryout attempt. */
export const startTryout = Effect.fnUntraced(function* (args: {
  readonly locale: Locale;
  readonly product: TryoutProduct;
  readonly tryoutSlug: string;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const { appUser } = yield* requireAppUser();
  const userId = appUser._id;
  const now = yield* Clock.currentTimeMillis;
  const startableTryoutResult = yield* Effect.either(loadStartableTryout(args));

  if (Either.isLeft(startableTryoutResult)) {
    const error = startableTryoutResult.left;

    if (error.code === "TRYOUT_NOT_FOUND") {
      return { kind: "not-found" as const };
    }

    if (error.code === "TRYOUT_INACTIVE") {
      return { kind: "inactive" as const };
    }

    return yield* Effect.fail(error);
  }

  const tryout = startableTryoutResult.right;
  const scaleVersion = yield* getLatestScaleVersionForTryout(tryout._id);
  const existingAttempt = yield* reader
    .table("tryoutAttempts")
    .index(
      "by_userId_and_tryoutId_and_startedAt",
      (query) => query.eq("userId", userId).eq("tryoutId", tryout._id),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!scaleVersion) {
    return { kind: "not-ready" as const };
  }

  if (existingAttempt) {
    const canReuseAttempt = yield* reuseExistingTryoutAttempt(ctx, {
      now,
      tryoutAttempt: existingAttempt,
      userId,
    });

    if (canReuseAttempt) {
      return { kind: "started" as const };
    }
  }

  const eventEntitlements = yield* resolveActiveTryoutEventEntitlements({
    now,
    product: tryout.product,
    userId,
  });
  const activeSubscription = yield* getActiveTryoutSubscriptionForUserProduct({
    now,
    product: tryout.product,
    userId,
  });
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
    ? yield* reader
        .table("tryoutAttempts")
        .index(
          "by_userId_and_tryoutId_and_accessCampaignId_and_startedAt",
          (query) =>
            query
              .eq("userId", userId)
              .eq("tryoutId", tryout._id)
              .eq("accessCampaignId", activeCompetitionCampaignId),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull))
    : null;
  const competitionStartSource =
    activeCompetitionEntitlement &&
    activeCompetitionCampaignId &&
    activeCompetitionGrantId &&
    !competitionAttempt
      ? {
          accessCampaignId: activeCompetitionCampaignId,
          accessCampaignKind: "competition" as const,
          accessEndsAt: activeCompetitionEntitlement.endsAt,
          accessGrantId: activeCompetitionGrantId,
          accessKind: "event" as const,
          countsForCompetition: true,
        }
      : null;
  const accessPassEntitlement =
    eventEntitlements.accessPassEntitlement?.accessCampaignId &&
    eventEntitlements.accessPassEntitlement.accessGrantId
      ? eventEntitlements.accessPassEntitlement
      : null;
  const accessPassCampaignId = accessPassEntitlement?.accessCampaignId ?? null;
  const accessPassGrantId = accessPassEntitlement?.accessGrantId ?? null;
  const accessPassStartSource =
    accessPassEntitlement && accessPassCampaignId && accessPassGrantId
      ? {
          accessCampaignId: accessPassCampaignId,
          accessCampaignKind: "access-pass" as const,
          accessEndsAt: accessPassEntitlement.endsAt,
          accessGrantId: accessPassGrantId,
          accessKind: "event" as const,
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
    competitionStartSource ?? accessPassStartSource ?? subscriptionStartSource;

  if (!accessSource) {
    if (competitionAttempt) {
      return { kind: "competition-attempt-used" as const };
    }

    return { kind: "requires-access" as const };
  }

  const partSetSnapshots = yield* loadTryoutPartSnapshots({
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const attemptNumber = existingAttempt ? existingAttempt.attemptNumber + 1 : 1;
  const attemptWindowEndsAt =
    now + tryoutProductPolicies[tryout.product].attemptWindowMs;
  const expiresAt =
    accessSource.accessKind === "event" &&
    accessSource.accessCampaignKind === "competition"
      ? Math.min(attemptWindowEndsAt, accessSource.accessEndsAt)
      : attemptWindowEndsAt;
  const tryoutAttemptId = yield* writer.table("tryoutAttempts").insert({
    accessCampaignId:
      accessSource.accessKind === "event"
        ? accessSource.accessCampaignId
        : undefined,
    accessCampaignKind:
      accessSource.accessKind === "event"
        ? accessSource.accessCampaignKind
        : undefined,
    accessEndsAt:
      accessSource.accessKind === "event"
        ? accessSource.accessEndsAt
        : undefined,
    accessGrantId:
      accessSource.accessKind === "event"
        ? accessSource.accessGrantId
        : undefined,
    accessKind: accessSource.accessKind,
    attemptNumber,
    completedAt: null,
    completedPartIndices: [],
    countsForCompetition: accessSource.countsForCompetition,
    endReason: null,
    expiresAt,
    lastActivityAt: now,
    partSetSnapshots,
    scaleVersionId: scaleVersion._id,
    scoreStatus: scaleVersion.status,
    startedAt: now,
    status: "in-progress",
    theta: 0,
    thetaSE: 1,
    totalCorrect: 0,
    totalQuestions: 0,
    tryoutId: tryout._id,
    userId,
  });

  yield* scheduler.runAfter(
    Duration.millis(Math.max(0, expiresAt - now)),
    refs.internal.tryouts.mutations.internalFunctions.expiry
      .expireTryoutAttemptInternal,
    { expiresAtMs: expiresAt, tryoutAttemptId }
  );

  return { kind: "started" as const };
});

/** Starts or resumes one part of an active tryout attempt. */
export const startPart = Effect.fnUntraced(function* (args: {
  readonly partKey: string;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const { appUser } = yield* requireAppUser();
  const userId = appUser._id;
  const now = yield* Clock.currentTimeMillis;
  const partStartContext = yield* loadPartStartContext({
    now,
    partKey: args.partKey,
    tryoutAttemptId: args.tryoutAttemptId,
    userId,
  }).pipe(
    Effect.catchTag("TryoutError", (error) => {
      if (error.code === "TRYOUT_EXPIRED") {
        return Effect.succeed(null);
      }

      return Effect.fail(error);
    })
  );

  if (!partStartContext) {
    return { kind: "tryout-expired" as const };
  }

  const { tryout, tryoutPartSnapshot } = partStartContext;
  const existingPartAttempt = yield* reuseExistingPartAttempt({
    now,
    partIndex: tryoutPartSnapshot.partIndex,
    tryoutAttemptId: args.tryoutAttemptId,
  }).pipe(
    Effect.catchTag("TryoutError", (error) => {
      if (error.code === "TRYOUT_PART_EXPIRED") {
        return Effect.succeed("part-expired" as const);
      }

      return Effect.fail(error);
    })
  );

  if (existingPartAttempt === "part-expired") {
    return { kind: "part-expired" as const };
  }

  if (existingPartAttempt) {
    return { kind: "started" as const };
  }

  const set = yield* reader
    .table("exerciseSets")
    .get(tryoutPartSnapshot.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new TryoutError({
        code: "SET_NOT_FOUND",
        message: "Exercise set not found.",
      })
    );
  }

  const timeLimit = tryoutProductPolicies[
    tryout.product
  ].getPartTimeLimitSeconds(tryoutPartSnapshot.questionCount);
  const setAttemptId = yield* createExerciseAttempt({
    mode: "simulation",
    origin: "tryout",
    scope: "set",
    slug: set.slug,
    startedAt: now,
    timeLimit,
    totalExercises: tryoutPartSnapshot.questionCount,
    userId,
  });

  yield* writer.table("tryoutPartAttempts").insert({
    partIndex: tryoutPartSnapshot.partIndex,
    partKey: tryoutPartSnapshot.partKey,
    setAttemptId,
    setId: tryoutPartSnapshot.setId,
    theta: 0,
    thetaSE: 1,
    tryoutAttemptId: args.tryoutAttemptId,
  });
  yield* writer.table("tryoutAttempts").patch(args.tryoutAttemptId, {
    lastActivityAt: now,
  });

  return { kind: "started" as const };
});

/** Completes a tryout part and finalizes the attempt when all parts are done. */
export const completePart = Effect.fnUntraced(function* (args: {
  readonly partKey: string;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const { appUser } = yield* requireAppUser();
  const userId = appUser._id;
  const now = yield* Clock.currentTimeMillis;
  const currentTryoutAttempt = yield* Effect.gen(function* () {
    const ownedAttempt = yield* requireOwnedTryoutAttempt({
      tryoutAttemptId: args.tryoutAttemptId,
      userId,
    });
    return yield* requireActiveTryoutAttemptAfterExpirySync({
      now,
      tryoutAttempt: ownedAttempt,
    });
  }).pipe(
    Effect.catchTag("TryoutError", (error) => {
      if (error.code === "TRYOUT_EXPIRED") {
        return Effect.succeed(null);
      }

      return Effect.fail(error);
    })
  );

  if (!currentTryoutAttempt) {
    return { kind: "tryout-expired" as const };
  }

  const tryout = yield* reader
    .table("tryouts")
    .get(currentTryoutAttempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  const currentPartSets = yield* loadValidatedTryoutPartSets({
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const resolvedPart = resolveRequestedTryoutPart({
    currentPartSets,
    partSetSnapshots: currentTryoutAttempt.partSetSnapshots,
    requestedPartKey: args.partKey,
  });

  if (!resolvedPart) {
    return yield* Effect.fail(
      new TryoutError({
        code: "PART_ATTEMPT_NOT_FOUND",
        message: "Tryout part attempt not found.",
      })
    );
  }

  const partAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_tryoutAttemptId_and_partIndex", (query) =>
      query
        .eq("tryoutAttemptId", args.tryoutAttemptId)
        .eq("partIndex", resolvedPart.snapshot.partIndex)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!partAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "PART_ATTEMPT_NOT_FOUND",
        message: "Tryout part attempt not found.",
      })
    );
  }

  if (
    currentTryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)
  ) {
    return { kind: "completed" as const };
  }

  yield* finalizeTryoutPartAttempt({
    finishedAtMs: now,
    now,
    partAttempt,
    status: "completed",
    tryoutAttemptId: args.tryoutAttemptId,
  });

  const refreshedTryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(args.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!refreshedTryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  yield* finalizeTryoutAttempt({
    ctx,
    now,
    tryoutAttempt: refreshedTryoutAttempt,
    userId,
  });

  return { kind: "completed" as const };
});
