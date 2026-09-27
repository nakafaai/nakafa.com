import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { tryoutResponseSelectionValidator } from "@repo/backend/confect/tryouts/response/model";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSectionAttemptId: IdSchema("tryoutSectionAttempts"),
    placementId: IdSchema("tryoutAttemptPlacements"),
    isComplete: Schema.Boolean,
    selection: tryoutResponseSelectionValidator,
    isCorrect: Schema.Boolean,
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
