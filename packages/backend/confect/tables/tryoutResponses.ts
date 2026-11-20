import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import {
  QuestionGrade,
  QuestionResponse,
} from "@repo/backend/confect/assessment/parts";
import { Schema } from "effect";

/**
 * One learner's answer to one place of an attempt, graded by its frozen rules when it is written. A place of one
 * interaction holds that interaction's response and grade; a place of several holds the response of each part the
 * learner answered and each part's grade beside their sum (`assessment/parts`), so one row answers one question.
 */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSectionAttemptId: IdSchema("tryoutSectionAttempts"),
    placementId: IdSchema("tryoutAttemptPlacements"),
    response: QuestionResponse,
    grade: QuestionGrade,
    timeSpent: Schema.Finite,
    answeredAt: Schema.Finite,
    updatedAt: Schema.Finite,
    /** The version of the write that stored it. */
    version: Version,
  })
)
  .index("by_tryoutSectionAttemptId_and_answeredAt", [
    "tryoutSectionAttemptId",
    "answeredAt",
  ])
  .index("by_tryoutAttemptId_and_answeredAt", ["tryoutAttemptId", "answeredAt"])
  .index("by_placementId", ["placementId"]);
