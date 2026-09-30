import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutStatus } from "@repo/backend/confect/tryouts/status";
import { Effect } from "effect";

/**
 * Leading questions of a finished section whose answers a free learner may
 * read, so the review offer shows real explanations before the upgrade.
 */
export const TRYOUT_REVIEW_PREVIEW_QUESTIONS = 2;

/** Derives question access and review state from one coherent lifecycle. */
function getTryoutSectionLifecycle(
  attemptStatus: TryoutStatus,
  sectionStatus: TryoutStatus
) {
  const isActive =
    attemptStatus === "in-progress" && sectionStatus === "in-progress";
  const isReview =
    attemptStatus !== "in-progress" && sectionStatus !== "in-progress";
  return {
    isReview,
    questions: isActive || isReview,
  };
}

/**
 * Resolves lifecycle access and the current billing-owned Pro plan together.
 * `answers` opens every answer of a finished section to Pro learners;
 * `preview` opens only its leading questions to everyone else.
 */
export const readTryoutSectionContentAccess = Effect.fn(
  "tryouts.content.readAccess"
)(function* (attempt: Docs["tryoutAttempts"], sectionStatus: TryoutStatus) {
  const lifecycle = getTryoutSectionLifecycle(attempt.status, sectionStatus);
  if (!lifecycle.isReview) {
    return {
      answers: false,
      preview: false,
      questions: lifecycle.questions,
    };
  }
  const database = yield* DatabaseReader;
  const user = yield* database
    .table("users")
    .get(attempt.userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (!user) {
    return {
      answers: false,
      preview: false,
      questions: false,
    };
  }
  const pro = user.plan === "pro";
  return {
    answers: pro,
    preview: !pro,
    questions: true,
  };
});
