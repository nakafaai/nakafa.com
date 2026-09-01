import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  readSectionCompletion,
  requireFinalSectionAttempts,
} from "@repo/backend/convex/tryouts/runtime/completion";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import {
  loadAttemptPlacements,
  loadSectionPlacements,
  requireSectionSnapshot,
} from "@repo/backend/convex/tryouts/runtime/placement";
import {
  loadAttemptResponses,
  loadSectionResponseIndex,
  type TryoutAttemptResponseIndex,
  type TryoutResponseIndex,
} from "@repo/backend/convex/tryouts/runtime/response";
import { getSectionScoreSnapshot } from "@repo/backend/convex/tryouts/runtime/result";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  loadSectionScoreSource,
  scoreTryoutSection,
  summarizeResponses,
  type TryoutScoreSource,
} from "@repo/backend/convex/tryouts/runtime/score";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Returns the earliest timestamp that can end an attempt. */
export function getAttemptExpiresAt(attempt: TryoutAttempt) {
  return Math.min(attempt.expiresAt, attempt.accessEndsAt);
}

/** Expires an attempt using its entitlement-bounded timer. */
export const expireAttemptAtEffectiveTime = Effect.fn(
  "tryouts.runtime.expireAttemptAtEffectiveTime"
)(function* (ctx: MutationCtx, args: { attempt: TryoutAttempt; now: number }) {
  const expiresAt = getAttemptExpiresAt(args.attempt);

  if (expiresAt === args.attempt.expiresAt) {
    return yield* expireAttempt(ctx, args);
  }

  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.attempt._id, {
      expiresAt,
      lastActivityAt: args.now,
    })
  );

  const currentAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attempt._id)
  );

  if (!currentAttempt) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return yield* expireAttempt(ctx, { attempt: currentAttempt, now: args.now });
});

/** Creates an expired section attempt for a section the user never opened. */
const createExpiredSectionAttempt = Effect.fn(
  "tryouts.runtime.createExpiredSectionAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    responseIndex: TryoutResponseIndex;
    scoreSource: TryoutScoreSource;
    snapshot: TryoutSectionSnapshot;
  }
) {
  const score = yield* scoreTryoutSection({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses: [...args.responseIndex.responses.values()],
    source: args.scoreSource,
    totalQuestions: args.snapshot.questionCount,
  });
  const sectionScore = yield* getSectionScoreSnapshot(score);

  yield* tryRuntimePromise(() =>
    ctx.db.insert("tryoutSectionAttempts", {
      answeredCount: 0,
      completedAt: args.attempt.expiresAt,
      correctAnswers: 0,
      endReason: "time-expired",
      expiresAt: args.attempt.expiresAt,
      lastActivityAt: args.now,
      sectionIdentity: args.snapshot.sectionIdentity,
      sectionKey: args.snapshot.sectionKey,
      sectionOrder: args.snapshot.sectionOrder,
      score: sectionScore,
      startedAt: args.attempt.expiresAt,
      status: "expired",
      totalQuestions: args.snapshot.questionCount,
      tryoutAttemptId: args.attempt._id,
    })
  );
});

/** Creates expired attempts for unopened sections before final scoring. */
const createMissingExpiredSectionAttempts = Effect.fn(
  "tryouts.runtime.createMissingExpiredSections"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    responseIndex: TryoutResponseIndex;
    scoreSource: TryoutScoreSource;
    sections: TryoutSectionAttempt[];
  }
) {
  const attemptedSectionKeys = new Set(
    args.sections.map((section) => section.sectionKey)
  );

  for (const snapshot of args.attempt.sectionSnapshots) {
    if (attemptedSectionKeys.has(snapshot.sectionKey)) {
      continue;
    }

    yield* createExpiredSectionAttempt(ctx, {
      attempt: args.attempt,
      now: args.now,
      responseIndex: selectSectionResponseIndex(
        args.responseIndex,
        snapshot.sectionIdentity
      ),
      scoreSource: args.scoreSource,
      snapshot,
    });
  }
});

/** Finalizes one section attempt and finalizes the parent attempt if complete. */
export const finalizeSectionAttempt = Effect.fn(
  "tryouts.runtime.finalizeSectionAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    endReason: TryoutEndReason;
    now: number;
    section: TryoutSectionAttempt;
  }
) {
  const completion = yield* readSectionCompletion(args.attempt, args.section);

  let attemptResponseIndex: TryoutAttemptResponseIndex | null = null;
  let scoreSource: TryoutScoreSource;
  let sectionResponseIndex: TryoutResponseIndex;

  if (completion.completesAttempt) {
    const placements = yield* loadAttemptPlacements(ctx, args.attempt);
    attemptResponseIndex = yield* loadAttemptResponses(
      ctx,
      args.attempt,
      placements,
      "complete"
    );
    yield* requireFinalSectionAttempts(
      args.attempt,
      args.section,
      attemptResponseIndex.sections
    );
    scoreSource = yield* loadAttemptScoreSource(
      ctx,
      args.attempt,
      attemptResponseIndex.placements
    );
    sectionResponseIndex = selectSectionResponseIndex(
      attemptResponseIndex,
      args.section.sectionIdentity
    );
  } else {
    const snapshot = yield* requireSectionSnapshot(
      args.attempt,
      args.section.sectionKey
    );
    const placements = yield* loadSectionPlacements(
      ctx,
      args.attempt,
      snapshot
    );
    sectionResponseIndex = yield* loadSectionResponseIndex(
      ctx,
      args.attempt,
      args.section,
      placements
    );
    scoreSource = yield* loadSectionScoreSource(ctx, {
      attempt: args.attempt,
      placements: sectionResponseIndex.placements,
      sectionIdentity: args.section.sectionIdentity,
    });
  }

  const finalization = yield* readSectionFinalization({
    attempt: args.attempt,
    responseIndex: sectionResponseIndex,
    scoreSource,
    section: args.section,
  });
  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.section._id, {
      answeredCount: finalization.answeredCount,
      completedAt: args.now,
      correctAnswers: finalization.correctAnswers,
      endReason: args.endReason,
      lastActivityAt: args.now,
      score: finalization.score,
      status: args.endReason === "time-expired" ? "expired" : "completed",
    })
  );

  yield* tryRuntimePromise(() =>
    ctx.db.patch(args.attempt._id, {
      completedSectionKeys: completion.completedSectionKeys,
      lastActivityAt: args.now,
    })
  );

  if (!attemptResponseIndex) {
    return { kind: "completed" };
  }

  const currentAttempt = yield* tryRuntimePromise(() =>
    ctx.db.get(args.attempt._id)
  );
  if (!currentAttempt) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  yield* finalizeAttemptScore(ctx, {
    attempt: currentAttempt,
    endReason: "submitted",
    now: args.now,
    responseIndex: attemptResponseIndex,
    source: scoreSource,
  });

  return { kind: "completed" };
});

/** Expires one whole attempt and any in-progress section attempts it owns. */
export const expireAttempt = Effect.fn("tryouts.runtime.expireAttempt")(
  function* (ctx: MutationCtx, args: { attempt: TryoutAttempt; now: number }) {
    const placements = yield* loadAttemptPlacements(ctx, args.attempt);
    const responseIndex = yield* loadAttemptResponses(
      ctx,
      args.attempt,
      placements,
      "partial"
    );
    const scoreSource = yield* loadAttemptScoreSource(
      ctx,
      args.attempt,
      responseIndex.placements
    );
    const sections = responseIndex.sections;

    for (const section of sections) {
      if (section.status !== "in-progress") {
        continue;
      }

      const finalization = yield* readSectionFinalization({
        attempt: args.attempt,
        responseIndex: selectSectionResponseIndex(
          responseIndex,
          section.sectionIdentity
        ),
        scoreSource,
        section,
      });

      yield* tryRuntimePromise(() =>
        ctx.db.patch(section._id, {
          answeredCount: finalization.answeredCount,
          completedAt: args.attempt.expiresAt,
          correctAnswers: finalization.correctAnswers,
          endReason: "time-expired",
          lastActivityAt: args.now,
          score: finalization.score,
          status: "expired",
        })
      );
    }

    yield* createMissingExpiredSectionAttempts(ctx, {
      attempt: args.attempt,
      now: args.now,
      responseIndex,
      scoreSource,
      sections,
    });

    yield* tryRuntimePromise(() =>
      ctx.db.patch(args.attempt._id, {
        completedSectionKeys: args.attempt.sectionSnapshots.map(
          (section) => section.sectionKey
        ),
        lastActivityAt: args.now,
      })
    );

    const currentAttempt = yield* tryRuntimePromise(() =>
      ctx.db.get(args.attempt._id)
    );
    if (!currentAttempt) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }

    return yield* finalizeAttemptScore(ctx, {
      attempt: currentAttempt,
      endReason: "time-expired",
      now: args.now,
      responseIndex,
      source: scoreSource,
    });
  }
);

/** Calculates the immutable counters and score stored by one terminal section. */
const readSectionFinalization = Effect.fn(
  "tryouts.runtime.readSectionFinalization"
)(function* (args: {
  attempt: TryoutAttempt;
  responseIndex: TryoutResponseIndex;
  scoreSource: TryoutScoreSource;
  section: TryoutSectionAttempt;
}) {
  const responses = [...args.responseIndex.responses.values()];
  const summary = summarizeResponses(responses);
  const score = yield* scoreTryoutSection({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses,
    source: args.scoreSource,
    totalQuestions: args.section.totalQuestions,
  });
  const sectionScore = yield* getSectionScoreSnapshot(score);

  return {
    ...summary,
    score: sectionScore,
  };
});

/** Selects one section from an already-validated attempt response graph. */
function selectSectionResponseIndex(
  responseIndex: TryoutResponseIndex,
  sectionIdentity: string
): TryoutResponseIndex {
  const placements = responseIndex.placements.filter(
    (placement) => placement.sectionIdentity === sectionIdentity
  );
  const placementIds = new Set(placements.map((placement) => placement._id));
  const responses = new Map(
    [...responseIndex.responses].filter(([placementId]) =>
      placementIds.has(placementId)
    )
  );

  return { placements, responses };
}
