import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import irtScaleVersions from "@repo/backend/confect/_generated/tables/irtScaleVersions";
import tryoutAttempts from "@repo/backend/confect/_generated/tables/tryoutAttempts";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { createAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import type { TryoutSection } from "@repo/backend/confect/tryouts/runtime/schema";
import { startSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import {
  type FrozenPlacement,
  freezeAttempt,
} from "@repo/backend/confect/tryouts/start/freeze";
import { TryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import {
  startAttemptArgsValidator,
  toTryoutStartError,
} from "@repo/backend/confect/tryouts/start/spec";
import { Duration, Effect, flow, Schema, Struct } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutAttemptInsert = Omit<TryoutAttempt, "_creationTime" | "_id">;
const createTryoutAttemptInputSchema = Schema.Struct({
  access: tryoutAttempts.Doc.mapFields(
    Struct.pick([
      "accessEndsAt",
      "accessSourceKind",
      "accessSubscriptionId",
      "countsForCompetition",
    ])
  ),
  args: startAttemptArgsValidator,
  attemptNumber: Schema.Finite,
  now: Schema.Finite,
  scaleVersion: Schema.NullOr(irtScaleVersions.Doc),
  source: TryoutStartSource,
  userId: IdSchema("users"),
});
type CreateTryoutAttemptInput = typeof createTryoutAttemptInputSchema.Type;

/**
 * Freezes the set into an attempt and creates the attempt with all its start rows atomically: its
 * sections and places, its progress, the entry section a direct-entry set starts in, and its expiry.
 */
export const createTryoutAttempt = Effect.fn(
  "tryouts.start.createTryoutAttempt"
)(function* (input: CreateTryoutAttemptInput) {
  const writer = yield* DatabaseWriter;
  const frozen = yield* freezeAttempt({
    items: input.source.items,
    paper: input.source.paper.paper,
    profile: input.source.profile.profile,
    sections: input.source.sections,
  });
  const values = buildAttemptValues(
    input,
    frozen.sections,
    frozen.placements.length
  );
  const attemptId = yield* writer
    .table("tryoutAttempts")
    .insert(values)
    .pipe(Effect.mapError(toTryoutStartError));
  const attempt = yield* (yield* DatabaseReader)
    .table("tryoutAttempts")
    .get(attemptId)
    .pipe(Effect.mapError(toTryoutStartError));
  yield* persistAttemptStart({
    attempt,
    input,
    placements: frozen.placements,
  });
  return attempt;
});

/** Builds the complete immutable attempt row, from the source and its frozen sections, before any related writes. */
function buildAttemptValues(
  input: CreateTryoutAttemptInput,
  sections: readonly TryoutSection[],
  totalQuestions: number
): TryoutAttemptInsert {
  const { source } = input;
  return {
    ...input.access,
    appLocale: input.args.locale,
    assessmentSnapshotId: source.active.snapshotId,
    attemptNumber: input.attemptNumber,
    completedAt: null,
    completedSectionKeys: [],
    countryKey: source.set.countryKey,
    endReason: null,
    examKey: source.set.examKey,
    expiresAt: input.now + 3 * 24 * 60 * 60 * 1000,
    lastActivityAt: input.now,
    paper: { hash: source.paper.hash, id: source.paper.paper.id },
    profile: { hash: source.profile.hash, id: source.profile.profile.id },
    releaseId: source.active.releaseId,
    scoreStatus: input.scaleVersion?.status ?? "official",
    scoring: source.profile.profile.scoring,
    sections: [...sections],
    setIdentity: source.setIdentity,
    setKey: source.set.setKey,
    setPublicPath: source.set.publicPath,
    startedAt: input.now,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions,
    trackKey: source.set.trackKey,
    userId: input.userId,
    ...(input.scaleVersion ? { scaleVersionId: input.scaleVersion._id } : {}),
  };
}

/** Persists all attempt-owned side effects after the snapshot row exists. */
const persistAttemptStart = Effect.fn("tryouts.start.persistAttemptStart")(
  function* (args: {
    attempt: TryoutAttempt;
    input: CreateTryoutAttemptInput;
    placements: readonly FrozenPlacement[];
  }) {
    const scheduler = yield* Scheduler;
    const { attempt, input, placements } = args;
    yield* writeTryoutSetProgress({
      attempt,
      publishedScore: null,
      status: "in-progress",
      updatedAt: input.now,
    });
    yield* createAttemptPlacements(attempt, placements);
    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* startSectionAttempt({
        attempt,
        now: input.now,
        sectionKey: entrySectionKey,
      });
    }
    yield* scheduler
      .runAfter(
        Duration.millis(Math.max(0, attempt.expiresAt - input.now)),
        refs.internal.tryouts.mutations.expiry.attempt,
        {
          attemptId: attempt._id,
          expiresAt: attempt.expiresAt,
        }
      )
      .pipe(Effect.catchDefect(flow(toTryoutStartError, Effect.fail)));
    yield* captureProductEvent({
      distinctId: input.userId,
      event: {
        name: "tryout attempt started",
        properties: {
          access_source: input.access.accessSourceKind,
          attempt_number: attempt.attemptNumber,
          country_key: input.args.countryKey,
          exam_key: input.args.examKey,
          locale: input.args.locale,
          score_status: attempt.scoreStatus,
          set_key: input.args.setKey,
          track_key: input.args.trackKey,
        },
      },
      timestamp: input.now,
    });
  }
);
