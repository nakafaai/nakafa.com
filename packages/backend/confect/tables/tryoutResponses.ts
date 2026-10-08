import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Outcome, Selection } from "@repo/backend/confect/response/model";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSectionAttemptId: IdSchema("tryoutSectionAttempts"),
    placementId: IdSchema("tryoutAttemptPlacements"),
    isComplete: Schema.Boolean,
    selection: Selection,
    isCorrect: Schema.Boolean,
    /** How the answer scores; rows written before outcomes carry only `isCorrect`. */
    outcome: Schema.optionalKey(Outcome),
    timeSpent: Schema.Finite,
    answeredAt: Schema.Finite,
    updatedAt: Schema.Finite,
  })
)
  .index("by_tryoutSectionAttemptId_and_answeredAt", [
    "tryoutSectionAttemptId",
    "answeredAt",
  ])
  .index("by_tryoutAttemptId_and_answeredAt", ["tryoutAttemptId", "answeredAt"])
  .index("by_placementId", ["placementId"]);
