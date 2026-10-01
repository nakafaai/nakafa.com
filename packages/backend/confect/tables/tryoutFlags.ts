import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** One row exists exactly while a learner keeps a placement flagged for review. */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    tryoutSectionAttemptId: IdSchema("tryoutSectionAttempts"),
    placementId: IdSchema("tryoutAttemptPlacements"),
    flaggedAt: Schema.Finite,
  })
)
  .index("by_placementId", ["placementId"])
  .index("by_tryoutSectionAttemptId", ["tryoutSectionAttemptId"]);
