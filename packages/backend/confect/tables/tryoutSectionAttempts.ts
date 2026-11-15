import { Table } from "@confect/core";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { EndReason } from "@repo/backend/confect/assessment/gate/end";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutSectionScoreValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
/**
 * One section of an attempt once the learner starts it: its clock, its counters, and the language its
 * questions show in, which the learner chose on the section page and may switch while it runs or in
 * its review. The language never touches an answer or a grade.
 */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
    sectionOrder: Schema.Finite,
    questionLanguage: ContentLanguageSchema,
    status: tryoutStatusValidator,
    startedAt: Schema.Finite,
    expiresAt: Schema.Finite,
    completedAt: Schema.Union([Schema.Finite, Schema.Null]),
    endReason: Schema.Union([EndReason, Schema.Null]),
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
