import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Grade } from "@repo/backend/confect/assessment/grade";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Schema } from "effect";

/**
 * One checked question of a practice session: the learner's response and how its frozen rule graded it. A
 * checked question is final for its session, so a question holds one answer at most.
 */
export default Table.make(() =>
  Schema.Struct({
    practiceSessionId: IdSchema("practiceSessions"),
    practiceQuestionId: IdSchema("practiceQuestions"),
    response: ExamResponse,
    grade: Grade,
    checkedAt: Schema.Finite,
  })
)
  .index("by_practiceSessionId_and_checkedAt", [
    "practiceSessionId",
    "checkedAt",
  ])
  .index("by_practiceQuestionId", ["practiceQuestionId"]);
