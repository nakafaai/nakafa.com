import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { startSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import type { TryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import type {
  AttemptAccessFields,
  StartAttemptArgs,
} from "@repo/backend/convex/tryouts/start/spec";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutAttemptInsert = Omit<TryoutAttempt, "_creationTime" | "_id">;

const expireAttemptReference = makeFunctionReference<
  "mutation",
  { attemptId: Id<"tryoutAttempts">; expiresAt: number },
  null
>("tryouts/mutations/expiry:attempt");

interface CreateTryoutAttemptInput {
  readonly access: AttemptAccessFields;
  readonly args: StartAttemptArgs;
  readonly attemptNumber: number;
  readonly now: number;
  readonly scaleVersion: Doc<"irtScaleVersions"> | null;
  readonly source: TryoutStartSource;
  readonly userId: Id<"users">;
}

/** Creates the attempt snapshot and all start-related rows atomically. */
export const createTryoutAttempt = Effect.fn(
  "tryouts.start.createTryoutAttempt"
)(function* (ctx: MutationCtx, input: CreateTryoutAttemptInput) {
  const values = buildAttemptValues(input);
  const attemptId = yield* tryStartPromise(() =>
    ctx.db.insert("tryoutAttempts", values)
  );
  const attempt = yield* tryStartPromise(() => ctx.db.get(attemptId));

  if (!attempt) {
    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.attemptNotFound,
      message: "Try-out attempt not found.",
    });
  }

  yield* persistAttemptStart(ctx, { attempt, input });

  return { attemptId };
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
    expiresAt: Math.min(
      input.now + 3 * 24 * 60 * 60 * 1000,
      input.access.accessEndsAt
    ),
    lastActivityAt: input.now,
    scoreStatus: input.scaleVersion?.status ?? "official",
    startedAt: input.now,
    status: "in-progress",
    totalCorrect: 0,
    userId: input.userId,
    ...(input.scaleVersion ? { scaleVersionId: input.scaleVersion._id } : {}),
  } satisfies Partial<TryoutAttemptInsert>;
  if (input.source.kind === "filesystem") {
    const { set } = input.source;
    return {
      ...values,
      countryKey: set.countryKey,
      examKey: set.examKey,
      locale: set.locale,
      scoringStrategy: set.scoringStrategy,
      sectionSnapshots: input.source.sections.map((section) => ({
        publicPath: section.publicPath,
        questionCount: section.questionCount,
        questionSetId: section.questionSetId,
        questionSourcePath: section.questionSourcePath,
        sectionKey: section.sectionKey,
        sectionOrder: section.order,
        sourceRevision: section.sourceRevision,
        timeLimitSeconds: section.timeLimitSeconds,
        tryoutSectionId: section._id,
      })),
      setKey: set.setKey,
      totalQuestions: set.totalQuestionCount,
      trackKey: set.trackKey,
      tryoutSetId: set._id,
    };
  }

  const signedSet = input.source.snapshot.set.row;
  return {
    ...values,
    countryKey: signedSet.countryKey,
    examKey: signedSet.examKey,
    locale: signedSet.locale,
    scoringStrategy: signedSet.scoringStrategy,
    sectionSnapshots: input.source.snapshot.sections.map(({ section }) => ({
      publicPath: section.row.publicPath,
      questionCount: section.row.questionCount,
      questionSourcePath: section.row.questionSourcePath,
      sectionIdentity: tryoutCatalogIdentity(section.row),
      sectionKey: section.row.sectionKey,
      sectionOrder: section.row.order,
      sectionRowHash: section.rowHash,
      sourceRevision: section.row.sourceRevision,
      timeLimitSeconds: section.row.timeLimitSeconds,
    })),
    setIdentity: input.source.snapshot.setIdentity,
    setKey: signedSet.setKey,
    totalQuestions: signedSet.questionCount,
    trackKey: signedSet.trackKey,
    ...(input.source.retainedTryoutSetId
      ? { tryoutSetId: input.source.retainedTryoutSetId }
      : {}),
    tryoutSnapshotId: input.source.snapshot.snapshotId,
  };
}

/** Persists all attempt-owned side effects after the snapshot row exists. */
const persistAttemptStart = Effect.fn("tryouts.start.persistAttemptStart")(
  function* (
    ctx: MutationCtx,
    args: { attempt: TryoutAttempt; input: CreateTryoutAttemptInput }
  ) {
    const { attempt, input } = args;

    yield* writeTryoutSetProgress(ctx, {
      attempt,
      publishedScore: null,
      status: "in-progress",
      updatedAt: input.now,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TryoutStartError({
            code: error.code,
            message: error.message,
          })
      )
    );
    yield* createAttemptPlacements(ctx, {
      attempt,
      source: input.source,
    });

    const entrySectionKey = input.args.entrySectionKey;
    if (entrySectionKey) {
      yield* startSectionAttempt(ctx, {
        attempt,
        now: input.now,
        sectionKey: entrySectionKey,
      }).pipe(Effect.mapError(toTryoutStartError));
    }

    yield* tryStartPromise(() =>
      ctx.scheduler.runAfter(
        Math.max(0, attempt.expiresAt - input.now),
        expireAttemptReference,
        { attemptId: attempt._id, expiresAt: attempt.expiresAt }
      )
    );
    yield* captureProductEvent(ctx, {
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
    }).pipe(Effect.mapError(toTryoutStartError));
  }
);

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
