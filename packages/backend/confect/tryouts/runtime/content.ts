import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutStatus } from "@repo/backend/confect/tryouts/status";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";

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
)(function* (
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">,
  sectionStatus: TryoutStatus
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const access = getTryoutSectionContentAccess(attempt.status, sectionStatus);
  if (!access.answers) {
    return access;
  }
  const user = yield* database
    .table("users")
    .get(attempt.userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie,
      Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
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
