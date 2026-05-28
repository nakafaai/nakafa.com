import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { getTryoutAccessCampaignByOptionalId } from "@repo/backend/confect/modules/tryout/tryoutAccessCampaignRead.service";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { getBoundedExerciseAnswers } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import { buildUserTryoutAttemptResult } from "@repo/backend/confect/modules/tryout/tryoutMeAttemptResult.service";
import { loadResolvedUserTryoutContext } from "@repo/backend/confect/modules/tryout/tryoutMeContext.service";
import { loadUserTryoutAttemptHistoryPage } from "@repo/backend/confect/modules/tryout/tryoutMeHistory.service";
import {
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { getTryoutPublicResultStatus } from "@repo/backend/confect/modules/tryout/tryoutResultStatus.service";
import { Effect, Option } from "effect";

const INITIAL_TRYOUT_HISTORY_PAGE_SIZE = 25;

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

interface UserTryoutRouteArgs {
  readonly attemptId?: string;
  readonly locale: Locale;
  readonly product: TryoutProduct;
  readonly tryoutSlug: string;
}

/** Returns the current user's tryout attempt state. */
export const getUserTryoutAttempt = Effect.fn(
  "tryouts.me.getUserTryoutAttempt"
)(function* (args: UserTryoutRouteArgs) {
  const { appUser } = yield* requireAppUser();
  const context = yield* loadResolvedUserTryoutContext({
    ...args,
    userId: appUser._id,
  });

  if (!context) {
    return null;
  }

  return yield* buildUserTryoutAttemptResult(context);
});

/** Returns a page of the current user's tryout history. */
export const getUserTryoutAttemptHistory = Effect.fn(
  "tryouts.me.getUserTryoutAttemptHistory"
)(function* (
  args: UserTryoutRouteArgs & { readonly paginationOpts: PaginationOpts }
) {
  const { appUser } = yield* requireAppUser();
  const context = yield* loadResolvedUserTryoutContext({
    ...args,
    userId: appUser._id,
  });

  if (!context) {
    return {
      continueCursor: "",
      isDone: true,
      page: [],
    };
  }

  return yield* loadUserTryoutAttemptHistoryPage({
    paginationOpts: args.paginationOpts,
    tryout: context.tryout,
    userId: appUser._id,
  });
});

/** Returns session status for the current user's visible tryout attempt. */
export const getUserTryoutSession = Effect.fn(
  "tryouts.me.getUserTryoutSession"
)(function* (args: UserTryoutRouteArgs) {
  const { appUser } = yield* requireAppUser();
  const context = yield* loadResolvedUserTryoutContext({
    ...args,
    userId: appUser._id,
  });

  if (!context) {
    return null;
  }

  return {
    attemptId: context.attempt._id,
    expiresAtMs: context.attempt.expiresAt,
    status: context.attempt.status,
  };
});

/** Returns the attempt and initial history used by the set-level tryout view. */
export const getUserTryoutSetView = Effect.fn(
  "tryouts.me.getUserTryoutSetView"
)(function* (args: UserTryoutRouteArgs) {
  const { appUser } = yield* requireAppUser();
  const context = yield* loadResolvedUserTryoutContext({
    ...args,
    userId: appUser._id,
  });

  if (!context) {
    return null;
  }

  const attemptData = yield* buildUserTryoutAttemptResult(context);
  const initialHistory = yield* loadUserTryoutAttemptHistoryPage({
    paginationOpts: {
      cursor: null,
      numItems: INITIAL_TRYOUT_HISTORY_PAGE_SIZE,
    },
    tryout: context.tryout,
    userId: appUser._id,
  });

  return {
    attemptData,
    initialHistory,
  };
});

/** Returns one tryout part attempt and its answers for the current user. */
export const getUserTryoutPartAttempt = Effect.fn(
  "tryouts.me.getUserTryoutPartAttempt"
)(function* (args: UserTryoutRouteArgs & { readonly partKey: string }) {
  const { appUser } = yield* requireAppUser();
  const context = yield* loadResolvedUserTryoutContext({
    ...args,
    userId: appUser._id,
  });

  if (!context) {
    return null;
  }

  const { attempt: tryoutAttempt, tryout } = context;
  const accessCampaign = yield* getTryoutAccessCampaignByOptionalId(
    tryoutAttempt.accessCampaignId
  );
  const scoredTryoutAttempt = {
    ...tryoutAttempt,
    irtScore: getTryoutReportScore(tryout.product, tryoutAttempt.theta),
    publicResultStatus: getTryoutPublicResultStatus({
      accessCampaign,
      tryoutAttempt,
    }),
  };
  const endedAttemptHasUntouchedParts =
    tryoutAttempt.status !== "in-progress" &&
    tryoutAttempt.completedPartIndices.length <
      tryoutAttempt.partSetSnapshots.length;
  const finalizedSnapshot = endedAttemptHasUntouchedParts
    ? yield* buildFinalizedTryoutSnapshot({
        scaleVersionId: tryoutAttempt.scaleVersionId,
        tryout,
        tryoutAttempt,
      })
    : null;
  const resolvedTryoutAttempt = finalizedSnapshot
    ? {
        ...scoredTryoutAttempt,
        irtScore: finalizedSnapshot.irtScore,
        theta: finalizedSnapshot.theta,
        thetaSE: finalizedSnapshot.thetaSE,
        totalCorrect: finalizedSnapshot.totalCorrect,
        totalQuestions: finalizedSnapshot.totalQuestions,
      }
    : scoredTryoutAttempt;
  const currentPartSets = yield* loadValidatedTryoutPartSets({
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const resolvedPart = resolveRequestedTryoutPart({
    currentPartSets,
    partSetSnapshots: tryoutAttempt.partSetSnapshots,
    requestedPartKey: args.partKey,
  });

  if (!resolvedPart) {
    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      part: null,
      partAttempt: null,
      partScore: null,
      tryoutAttempt: resolvedTryoutAttempt,
    };
  }

  const reader = yield* DatabaseReader;
  const set = yield* reader
    .table("exerciseSets")
    .get(resolvedPart.snapshot.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout part is missing its exercise set.",
      })
    );
  }

  const part = {
    currentPartKey: resolvedPart.currentPartKey,
    material: set.material,
    questionCount: resolvedPart.snapshot.questionCount,
    setSlug: set.slug,
  };
  const currentPartAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_tryoutAttemptId_and_partIndex", (query) =>
      query
        .eq("tryoutAttemptId", tryoutAttempt._id)
        .eq("partIndex", resolvedPart.snapshot.partIndex)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!currentPartAttempt) {
    if (finalizedSnapshot) {
      const partSnapshot = finalizedSnapshot.partSnapshots.find(
        (snapshot) => snapshot.partIndex === resolvedPart.snapshot.partIndex
      );

      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        part,
        partAttempt: null,
        partScore: partSnapshot?.score ?? null,
        tryoutAttempt: resolvedTryoutAttempt,
      };
    }

    if (tryoutAttempt.status !== "in-progress") {
      return yield* Effect.fail(
        new TryoutError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Finalized tryout is missing its part attempt.",
        })
      );
    }

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      part,
      partAttempt: null,
      partScore: null,
      tryoutAttempt: resolvedTryoutAttempt,
    };
  }

  const setAttempt = yield* reader
    .table("exerciseAttempts")
    .get(currentPartAttempt.setAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!setAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part is missing its exercise attempt.",
      })
    );
  }

  const answers = yield* getBoundedExerciseAnswers({
    attemptId: currentPartAttempt.setAttemptId,
    totalExercises: setAttempt.totalExercises,
  });
  const isCompletedPart = tryoutAttempt.completedPartIndices.includes(
    currentPartAttempt.partIndex
  );
  const resolvedPartScore =
    finalizedSnapshot?.partSnapshots.find(
      (snapshot) => snapshot.partIndex === resolvedPart.snapshot.partIndex
    )?.score ?? null;
  let partScore = resolvedPartScore;

  if (!partScore && isCompletedPart) {
    partScore = {
      correctAnswers: setAttempt.correctAnswers,
      irtScore: getTryoutReportScore(tryout.product, currentPartAttempt.theta),
      theta: currentPartAttempt.theta,
      thetaSE: currentPartAttempt.thetaSE,
    };
  }

  if (!partScore && tryoutAttempt.status !== "in-progress") {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Finalized tryout part is missing its score.",
      })
    );
  }

  return {
    expiresAtMs: tryoutAttempt.expiresAt,
    part,
    partAttempt: {
      answers,
      partIndex: currentPartAttempt.partIndex,
      partKey: resolvedPart.currentPartKey,
      setAttempt,
    },
    partScore,
    tryoutAttempt: resolvedTryoutAttempt,
  };
});
