import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { startSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
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
  readonly sections: Doc<"tryoutSections">[];
  readonly set: Doc<"tryoutSets">;
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
  return {
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
    scoringStrategy: input.set.scoringStrategy,
    sectionSnapshots: input.sections.map((section) => ({
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
    startedAt: input.now,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: input.set.totalQuestionCount,
    tryoutSetId: input.set._id,
    userId: input.userId,
    ...(input.scaleVersion ? { scaleVersionId: input.scaleVersion._id } : {}),
  };
}

/** Persists all attempt-owned side effects after the snapshot row exists. */
const persistAttemptStart = Effect.fn("tryouts.start.persistAttemptStart")(
  function* (
    ctx: MutationCtx,
    args: { attempt: TryoutAttempt; input: CreateTryoutAttemptInput }
  ) {
    const { attempt, input } = args;

    yield* tryStartPromise(() =>
      writeTryoutSetProgress(ctx, {
        attempt,
        publishedScore: null,
        set: input.set,
        status: "in-progress",
        updatedAt: input.now,
      })
    );
    yield* tryStartPromise(() => createAttemptPlacements(ctx, { attempt }));

    if (input.args.entrySectionKey) {
      yield* tryStartPromise(() =>
        startSectionAttempt(ctx, {
          attempt,
          now: input.now,
          sectionKey: input.args.entrySectionKey ?? "",
        })
      );
    }

    yield* tryStartPromise(() =>
      ctx.scheduler.runAfter(
        Math.max(0, attempt.expiresAt - input.now),
        expireAttemptReference,
        { attemptId: attempt._id, expiresAt: attempt.expiresAt }
      )
    );
    yield* tryStartPromise(() =>
      captureProductEvent(ctx, {
        distinctId: input.userId,
        event: {
          name: "tryout attempt started",
          properties: {
            access_source: input.access.accessSourceKind,
            attempt_number: attempt.attemptNumber,
            country_key: input.set.countryKey,
            exam_key: input.set.examKey,
            locale: input.set.locale,
            score_status: attempt.scoreStatus,
            set_key: input.set.setKey,
            track_key: input.set.trackKey,
          },
        },
        timestamp: new Date(input.now),
      })
    );
  }
);

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
