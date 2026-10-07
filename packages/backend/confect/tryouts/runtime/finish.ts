import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  readSectionCompletion,
  requireFinalSectionAttempts,
} from "@repo/backend/confect/tryouts/runtime/completion";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  loadAttemptPlacements,
  loadSectionPlacements,
} from "@repo/backend/confect/tryouts/runtime/placement";
import {
  loadAttemptResponses,
  loadSectionResponseIndex,
  type TryoutAttemptResponseIndex,
  type TryoutResponseIndex,
} from "@repo/backend/confect/tryouts/runtime/response";
import { getSectionScoreSnapshot } from "@repo/backend/confect/tryouts/runtime/result";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  loadSectionScoreSource,
  scoreTryoutSection,
  summarizeResponses,
  type TryoutScoreSource,
} from "@repo/backend/confect/tryouts/runtime/score";
import {
  Array as Arr,
  Effect,
  flow,
  MutableHashMap,
  MutableHashSet,
} from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Creates an expired section attempt for a section the user never opened. */
const createExpiredSectionAttempt = Effect.fn(
  "tryouts.runtime.createExpiredSectionAttempt"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  responseIndex: TryoutResponseIndex;
  scoreSource: TryoutScoreSource;
  snapshot: TryoutSectionSnapshot;
}) {
  const writer = yield* DatabaseWriter;
  const score = yield* scoreTryoutSection({
    attempt: args.attempt,
    placements: args.responseIndex.placements,
    responses: Arr.fromIterable(
      MutableHashMap.values(args.responseIndex.responses)
    ),
    source: args.scoreSource,
    totalQuestions: args.snapshot.questionCount,
  });
  const sectionScore = yield* getSectionScoreSnapshot(score);
  yield* writer
    .table("tryoutSectionAttempts")
    .insert({
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
    .pipe(Effect.orDie);
});

/** Creates expired attempts for unopened sections before final scoring. */
const createMissingExpiredSectionAttempts = Effect.fn(
  "tryouts.runtime.createMissingExpiredSections"
)(function* (args: {
  attempt: TryoutAttempt;
  now: number;
  responseIndex: TryoutResponseIndex;
  scoreSource: TryoutScoreSource;
  sections: readonly TryoutSectionAttempt[];
}) {
  const attemptedSectionKeys = MutableHashSet.fromIterable(
    Arr.map(args.sections, (section) => section.sectionKey)
  );
  for (const snapshot of args.attempt.sectionSnapshots) {
    if (MutableHashSet.has(attemptedSectionKeys, snapshot.sectionKey)) {
      continue;
    }
    yield* createExpiredSectionAttempt({
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
)(
  function* (args: {
    attempt: TryoutAttempt;
    endReason: TryoutEndReason;
    now: number;
    section: TryoutSectionAttempt;
  }) {
    const writer = yield* DatabaseWriter;
    const completion = yield* readSectionCompletion(args.attempt, args.section);
    let attemptResponseIndex: TryoutAttemptResponseIndex | null = null;
    let scoreSource: TryoutScoreSource;
    let sectionResponseIndex: TryoutResponseIndex;
    if (completion.completesAttempt) {
      const placements = yield* loadAttemptPlacements(args.attempt);
      attemptResponseIndex = yield* loadAttemptResponses(
        args.attempt,
        placements,
        "complete"
      );
      yield* requireFinalSectionAttempts(
        args.section,
        attemptResponseIndex.sections
      );
      scoreSource = yield* loadAttemptScoreSource(
        args.attempt,
        attemptResponseIndex.placements
      );
      sectionResponseIndex = selectSectionResponseIndex(
        attemptResponseIndex,
        args.section.sectionIdentity
      );
    } else {
      const placements = yield* loadSectionPlacements(
        args.attempt,
        completion.snapshot
      );
      sectionResponseIndex = yield* loadSectionResponseIndex(
        args.attempt,
        args.section,
        placements
      );
      scoreSource = yield* loadSectionScoreSource({
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
    yield* writer
      .table("tryoutSectionAttempts")
      .patch(args.section._id, {
        answeredCount: finalization.answeredCount,
        completedAt: args.now,
        correctAnswers: finalization.correctAnswers,
        endReason: args.endReason,
        lastActivityAt: args.now,
        score: finalization.score,
        status: args.endReason === "time-expired" ? "expired" : "completed",
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("tryoutAttempts")
      .patch(args.attempt._id, {
        completedSectionKeys: completion.completedSectionKeys,
        lastActivityAt: args.now,
      })
      .pipe(Effect.orDie);
    if (!attemptResponseIndex) {
      return {
        kind: "completed",
      };
    }
    yield* finalizeAttemptScore({
      attempt: {
        ...args.attempt,
        completedSectionKeys: completion.completedSectionKeys,
        lastActivityAt: args.now,
      },
      endReason: "submitted",
      now: args.now,
      responseIndex: attemptResponseIndex,
      source: scoreSource,
    });
    return {
      kind: "completed",
    };
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
);

/** Expires one whole attempt and any in-progress section attempts it owns. */
export const expireAttempt = Effect.fn("tryouts.runtime.expireAttempt")(
  function* (args: { attempt: TryoutAttempt; now: number }) {
    const writer = yield* DatabaseWriter;
    const placements = yield* loadAttemptPlacements(args.attempt);
    const responseIndex = yield* loadAttemptResponses(
      args.attempt,
      placements,
      "partial"
    );
    const scoreSource = yield* loadAttemptScoreSource(
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
      yield* writer
        .table("tryoutSectionAttempts")
        .patch(section._id, {
          answeredCount: finalization.answeredCount,
          completedAt: args.attempt.expiresAt,
          correctAnswers: finalization.correctAnswers,
          endReason: "time-expired",
          lastActivityAt: args.now,
          score: finalization.score,
          status: "expired",
        })
        .pipe(Effect.orDie);
    }
    yield* createMissingExpiredSectionAttempts({
      attempt: args.attempt,
      now: args.now,
      responseIndex,
      scoreSource,
      sections,
    });
    yield* writer
      .table("tryoutAttempts")
      .patch(args.attempt._id, {
        completedSectionKeys: Arr.map(
          args.attempt.sectionSnapshots,
          (section) => section.sectionKey
        ),
        lastActivityAt: args.now,
      })
      .pipe(Effect.orDie);
    return yield* finalizeAttemptScore({
      attempt: {
        ...args.attempt,
        completedSectionKeys: Arr.map(
          args.attempt.sectionSnapshots,
          (section) => section.sectionKey
        ),
        lastActivityAt: args.now,
      },
      endReason: "time-expired",
      now: args.now,
      responseIndex,
      source: scoreSource,
    });
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
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
  const responses = Arr.fromIterable(
    MutableHashMap.values(args.responseIndex.responses)
  );
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
  const placements = Arr.filter(
    responseIndex.placements,
    (placement) => placement.sectionIdentity === sectionIdentity
  );
  const placementIds = MutableHashSet.fromIterable(
    Arr.map(placements, (placement) => placement._id)
  );
  const responses = MutableHashMap.fromIterable(
    Arr.filter(Arr.fromIterable(responseIndex.responses), ([placementId]) =>
      MutableHashSet.has(placementIds, placementId)
    )
  );
  return {
    placements,
    responses,
  };
}
