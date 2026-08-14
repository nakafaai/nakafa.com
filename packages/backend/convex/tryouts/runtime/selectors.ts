import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { readTryoutAttemptHistory } from "@repo/backend/convex/tryouts/history/reference";
import { projectStoredTryoutContent } from "@repo/backend/convex/tryouts/history/selectors";
import type {
  TryoutAnswerSelector,
  TryoutQuestionSelector,
  TryoutSectionContentAccess,
} from "@repo/backend/convex/tryouts/runtime/content";
import { Effect, Schema } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;

/** Stable failure while resolving signed attempt selectors. */
export class TryoutSelectorReadError extends Schema.TaggedError<TryoutSelectorReadError>()(
  "TryoutSelectorReadError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_SELECTOR_INTEGRITY"),
    message: Schema.String,
  }
) {}

/** Returns exact protected selectors from one immutable signed attempt. */
export const loadTryoutSignedContent = Effect.fn(
  "tryouts.selectors.loadSignedContent"
)(function* (input: {
  readonly answers: boolean;
  readonly attempt: TryoutAttempt;
  readonly ctx: QueryCtx;
  readonly appLocale: AppLocaleCode;
  readonly sectionKey: string;
  readonly snapshotReleaseId: string;
  readonly snapshotId: string;
  readonly totalQuestions: number;
}) {
  if (
    input.attempt.snapshotReleaseId !== input.snapshotReleaseId ||
    input.attempt.tryoutSnapshotId !== input.snapshotId
  ) {
    return yield* selectorIntegrity(
      "Signed try-out attempt lost its locale or snapshot identity."
    );
  }
  const placements = yield* trySelectorPromise(() =>
    input.ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex(
        "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
        (index) =>
          index
            .eq("tryoutAttemptId", input.attempt._id)
            .eq("sectionKey", input.sectionKey)
      )
      .take(input.totalQuestions + 1)
  );
  return yield* projectTryoutSignedContent({
    answers: input.answers,
    attempt: input.attempt,
    ctx: input.ctx,
    appLocale: input.appLocale,
    placements,
    totalQuestions: input.totalQuestions,
  });
});

/** Projects protected selectors from already-loaded frozen placements. */
export const projectTryoutSignedContent = Effect.fn(
  "tryouts.selectors.projectSignedContent"
)(function* (input: {
  readonly answers: boolean;
  readonly attempt: TryoutAttempt;
  readonly ctx: QueryCtx;
  readonly appLocale: AppLocaleCode;
  readonly placements: readonly TryoutPlacement[];
  readonly totalQuestions: number;
}) {
  if (input.attempt.appLocale !== input.appLocale) {
    return yield* selectorIntegrity(
      "Signed try-out attempt lost its locale or snapshot identity."
    );
  }
  if (input.placements.length !== input.totalQuestions) {
    return yield* selectorIntegrity(
      "Signed try-out section lost one or more frozen placements."
    );
  }
  const history = yield* readTryoutAttemptHistory(input.ctx, input.attempt);
  if (history) {
    return yield* projectStoredTryoutContent({
      answers: input.answers,
      appLocale: input.appLocale,
      attempt: input.attempt,
      ctx: input.ctx,
      placements: input.placements,
    });
  }

  const content: Extract<TryoutSectionContentAccess, { runtime: "current" }> = {
    answers: input.answers
      ? yield* Effect.forEach(input.placements, (placement) =>
          makeAnswerSelector(
            placement,
            input.appLocale,
            input.attempt.tryoutSnapshotId,
            input.attempt.snapshotReleaseId
          )
        )
      : [],
    kind: "signed",
    questions: yield* Effect.forEach(input.placements, (placement) =>
      makeQuestionSelector(
        placement,
        input.appLocale,
        input.attempt.tryoutSnapshotId,
        input.attempt.snapshotReleaseId
      )
    ),
    runtime: "current",
  };
  return content;
});

/** Builds one authenticated question selector from a frozen placement. */
function makeQuestionSelector(
  placement: TryoutPlacement,
  appLocale: AppLocaleCode,
  snapshotId: string,
  snapshotReleaseId: string
) {
  if (
    !(
      placement.questionArtifactHash &&
      placement.questionContentKey &&
      placement.sectionKey
    )
  ) {
    return selectorIntegrity("Signed try-out question selector is incomplete.");
  }

  const selector: TryoutQuestionSelector = {
    appLocale,
    artifactHash: placement.questionArtifactHash,
    contentHash: placement.contentHash,
    contentKey: placement.questionContentKey,
    delivery: "authenticated",
    questionOrder: placement.questionOrder,
    snapshotReleaseId,
    snapshotId,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
  return Effect.succeed(selector);
}

/** Builds one entitled answer selector from a frozen placement. */
function makeAnswerSelector(
  placement: TryoutPlacement,
  appLocale: AppLocaleCode,
  snapshotId: string,
  snapshotReleaseId: string
) {
  if (!(placement.answerArtifactHash && placement.answerContentKey)) {
    return selectorIntegrity("Signed try-out answer selector is incomplete.");
  }

  const selector: TryoutAnswerSelector = {
    appLocale,
    artifactHash: placement.answerArtifactHash,
    contentHash: placement.contentHash,
    contentKey: placement.answerContentKey,
    delivery: "entitled",
    questionOrder: placement.questionOrder,
    snapshotReleaseId,
    snapshotId,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
  return Effect.succeed(selector);
}

/** Creates one typed fail-closed selector integrity error. */
function selectorIntegrity(message: string) {
  return new TryoutSelectorReadError({
    code: "TRYOUT_SELECTOR_INTEGRITY",
    message,
  });
}

/** Lifts one Convex read into the typed selector error channel. */
function trySelectorPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      new TryoutSelectorReadError({
        cause,
        code: "TRYOUT_SELECTOR_INTEGRITY",
        message: "Unable to read signed try-out selectors.",
      }),
    try: operation,
  });
}
