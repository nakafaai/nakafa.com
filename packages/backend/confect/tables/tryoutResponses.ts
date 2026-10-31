import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Grade } from "@repo/backend/confect/assessment/grade";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Schema } from "effect";

/** One learner's answer to one place of an attempt, graded by its frozen rule when it is written. */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSectionAttemptId: IdSchema("tryoutSectionAttempts"),
    placementId: IdSchema("tryoutAttemptPlacements"),
    response: ExamResponse,
    grade: Grade,
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
