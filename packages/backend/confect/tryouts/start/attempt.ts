import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import irtScaleVersions from "@repo/backend/confect/_generated/tables/irtScaleVersions";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { createAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { startSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import { tryoutStartSourceValidator } from "@repo/backend/confect/tryouts/start/source";
import {
  attemptAccessFieldsValidator,
  startAttemptArgsValidator,
  toTryoutStartError,
} from "@repo/backend/confect/tryouts/start/spec";
import { Array as Arr, Duration, Effect, flow, Schema } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutAttemptInsert = Omit<TryoutAttempt, "_creationTime" | "_id">;
const createTryoutAttemptInputValidator = Schema.Struct({
  access: attemptAccessFieldsValidator,
  args: startAttemptArgsValidator,
  attemptNumber: Schema.Finite,
  now: Schema.Finite,
  scaleVersion: Schema.NullOr(irtScaleVersions.Doc),
  source: tryoutStartSourceValidator,
  userId: IdSchema("users"),
});
type CreateTryoutAttemptInput = typeof createTryoutAttemptInputValidator.Type;

/** Creates the attempt snapshot and all start-related rows atomically. */
export const createTryoutAttempt = Effect.fn(
  "tryouts.start.createTryoutAttempt"
)(function* (input: CreateTryoutAttemptInput) {
  const writer = yield* DatabaseWriter;
  const values = buildAttemptValues(input);
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
  });
  return attempt;
});

/** Builds the complete immutable attempt row before any related writes. */
function buildAttemptValues(
  input: CreateTryoutAttemptInput
): TryoutAttemptInsert {
  const values = {
    ...input.access,
    attemptNumber: input.attemptNumber,
    completedAt: null,
    completedSectionKeys: [],
    endReason: null,
    expiresAt: input.now + 3 * 24 * 60 * 60 * 1000,
    lastActivityAt: input.now,
    scoreStatus: input.scaleVersion?.status ?? "official",
    startedAt: input.now,
    status: "in-progress",
    totalCorrect: 0,
    userId: input.userId,
    ...(input.scaleVersion
      ? {
          scaleVersionId: input.scaleVersion._id,
        }
      : {}),
  } satisfies Partial<TryoutAttemptInsert>;
  const signedSet = input.source.snapshot.set.row;
  return {
    ...values,
    countryKey: signedSet.countryKey,
    examKey: signedSet.examKey,
    appLocale: input.args.locale,
    scoringStrategy: signedSet.scoringStrategy,
    sectionSnapshots: Arr.map(
      input.source.snapshot.sections,
      ({ section }) => ({
        ...(section.row.marks === undefined
          ? {}
          : { marks: section.row.marks }),
        ...(section.row.publicPath === undefined
          ? {}
          : {
              publicPath: section.row.publicPath,
            }),
        questionCount: section.row.questionCount,
        questionSourcePath: section.row.questionSourcePath,
        sectionIdentity: tryoutCatalogIdentity(section.row),
        sectionKey: section.row.sectionKey,
        sectionOrder: section.row.order,
        sectionRowHash: section.rowHash,
        sourceRevision: section.row.sourceRevision,
        timeLimitSeconds: section.row.timeLimitSeconds,
      })
    ),
    setIdentity: input.source.snapshot.setIdentity,
    setKey: signedSet.setKey,
    setPublicPath: signedSet.publicPath,
    snapshotReleaseId: input.source.releaseId,
    totalQuestions: signedSet.questionCount,
    trackKey: signedSet.trackKey,
    tryoutBundleHash: input.source.bundle.bundleHash,
    tryoutBundleId: input.source.bundle._id,
    tryoutSnapshotId: input.source.snapshot.snapshotId,
  };
}

/** Persists all attempt-owned side effects after the snapshot row exists. */
const persistAttemptStart = Effect.fn("tryouts.start.persistAttemptStart")(
  function* (args: {
    attempt: TryoutAttempt;
    input: CreateTryoutAttemptInput;
  }) {
    const scheduler = yield* Scheduler;
    const { attempt, input } = args;
    yield* writeTryoutSetProgress({
      attempt,
      publishedScore: null,
      status: "in-progress",
      updatedAt: input.now,
    });
    yield* createAttemptPlacements({
      attempt,
      source: input.source,
    });
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
      timestamp: new Date(input.now),
    });
  }
);
