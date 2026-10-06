import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { readAttemptAnswer } from "@repo/backend/confect/tryouts/runtime/answer";
import { loadAttemptRuntimeBundle } from "@repo/backend/confect/tryouts/runtime/attempt/source";
import { isTryoutReviewPreviewQuestion } from "@repo/backend/confect/tryouts/runtime/content";
import { selectorIntegrity } from "@repo/backend/confect/tryouts/runtime/ownership";
import type {
  TryoutAnswerSelector,
  TryoutQuestionSelector,
  TryoutSectionContentAccess,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Array as Arr, Effect } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];

/**
 * Projects protected selectors from already-loaded frozen placements. Pro
 * learners receive every answer; a free learner's finished section receives
 * only the answers of its leading preview questions.
 */
export const projectTryoutSignedContent = Effect.fn(
  "tryouts.selectors.projectSignedContent"
)(function* (input: {
  readonly answers: boolean;
  readonly attempt: TryoutAttempt;
  readonly appLocale: AppLocaleCode;
  readonly placements: readonly TryoutPlacement[];
  readonly preview: boolean;
  readonly totalQuestions: number;
}) {
  if (input.placements.length !== input.totalQuestions) {
    return yield* selectorIntegrity(
      "Signed try-out section lost one or more frozen placements."
    );
  }
  const bundle = yield* loadAttemptRuntimeBundle(input.attempt);
  const answerSelector = (placement: TryoutPlacement) =>
    makeAnswerSelector(
      placement,
      bundle.bundleHash,
      input.appLocale,
      input.attempt.tryoutSnapshotId,
      input.attempt.snapshotReleaseId,
      input.attempt
    );
  const answers = input.answers
    ? yield* Effect.forEach(input.placements, answerSelector)
    : [];
  const previewAnswers = input.preview
    ? yield* Effect.forEach(
        Arr.filter(input.placements, (placement) =>
          isTryoutReviewPreviewQuestion(placement.questionOrder)
        ).sort((left, right) => left.questionOrder - right.questionOrder),
        answerSelector
      )
    : [];
  const questions = yield* Effect.forEach(input.placements, (placement) =>
    makeQuestionSelector(
      placement,
      bundle.bundleHash,
      input.appLocale,
      input.attempt.tryoutSnapshotId,
      input.attempt.snapshotReleaseId
    )
  );
  return {
    answers,
    kind: "signed",
    previewAnswers,
    questions,
  } satisfies TryoutSectionContentAccess;
});

/** Builds one authenticated question selector from a frozen placement. */
function makeQuestionSelector(
  placement: TryoutPlacement,
  bundleHash: string,
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
    bundleHash,
    contentHash: placement.contentHash,
    contentKey: placement.questionContentKey,
    delivery: "authenticated",
    questionOrder: placement.questionOrder,
    sectionKey: placement.sectionKey,
    snapshotReleaseId,
    snapshotId,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
  return Effect.succeed(selector);
}

/** Builds one entitled answer selector from a frozen placement. */
const makeAnswerSelector = Effect.fn("tryouts.selectors.makeAnswerSelector")(
  function* (
    placement: TryoutPlacement,
    bundleHash: string,
    appLocale: AppLocaleCode,
    snapshotId: string,
    snapshotReleaseId: string,
    attempt: TryoutAttempt
  ) {
    if (!(placement.answerArtifactHash && placement.answerContentKey)) {
      return yield* selectorIntegrity(
        "Signed try-out answer selector is incomplete."
      );
    }
    const answer = yield* readAttemptAnswer(attempt, placement, appLocale);
    const selector: TryoutAnswerSelector = {
      appLocale,
      artifactHash: answer.artifactHash,
      bundleHash,
      contentHash: placement.contentHash,
      contentKey: answer.contentKey,
      delivery: "entitled",
      questionOrder: placement.questionOrder,
      sectionKey: placement.sectionKey,
      snapshotReleaseId,
      snapshotId,
      sourcePath: placement.sourcePath,
      sourceRevision: placement.sourceRevision,
    };
    return selector;
  }
);
