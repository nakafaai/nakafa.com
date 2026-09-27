import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutStatus } from "@repo/backend/confect/tryouts/status";
import { Effect } from "effect";

/** Derives question and answer access from one coherent attempt lifecycle. */
function getTryoutSectionContentAccess(
  attemptStatus: TryoutStatus,
  sectionStatus: TryoutStatus
) {
  const isActive =
    attemptStatus === "in-progress" && sectionStatus === "in-progress";
  const isReview =
    attemptStatus !== "in-progress" && sectionStatus !== "in-progress";
  return {
    answers: isReview,
    questions: isActive || isReview,
  };
}

/** Resolves lifecycle access and the current billing-owned Pro plan together. */
export const readTryoutSectionContentAccess = Effect.fn(
  "tryouts.content.readAccess"
)(function* (attempt: Docs["tryoutAttempts"], sectionStatus: TryoutStatus) {
  const database = yield* DatabaseReader;
  const access = getTryoutSectionContentAccess(attempt.status, sectionStatus);
  if (!access.answers) {
    return access;
  }
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
      questions: false,
    };
  }
  return {
    ...access,
    answers: user.plan === "pro",
  };
});
