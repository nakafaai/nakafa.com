import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { attemptEndReasonValidator } from "@repo/backend/confect/lib/attempts";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutSectionScoreValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    sectionIdentity: Schema.String,
    sectionKey: tryoutRouteKeyValidator,
    sectionOrder: Schema.Finite,
    status: tryoutStatusValidator,
    startedAt: Schema.Finite,
    expiresAt: Schema.Finite,
    completedAt: Schema.Union([Schema.Finite, Schema.Null]),
    endReason: Schema.Union([attemptEndReasonValidator, Schema.Null]),
    lastActivityAt: Schema.Finite,
    totalQuestions: Schema.Finite,
    answeredCount: Schema.Finite,
    correctAnswers: Schema.Finite,
    score: Schema.optionalKey(tryoutSectionScoreValidator),
  })
)
  .index("by_tryoutAttemptId_and_sectionOrder", [
    "tryoutAttemptId",
    "sectionOrder",
  ])
  .index("by_tryoutAttemptId_and_sectionKey", ["tryoutAttemptId", "sectionKey"])
  .index("by_status_and_expiresAt", ["status", "expiresAt"]);
