import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * A learner's best published score on one set, the one row the set's leaderboard ranks them by
 * (`tryouts/rank`). A finished attempt that scores higher replaces it; a lower one leaves it.
 */
export default Table.make(() =>
  Schema.Struct({
    userId: IdSchema("users"),
    setIdentity: Schema.String,
    attemptId: IdSchema("tryoutAttempts"),
    publishedScore: Schema.Finite,
    finalizedAt: Schema.Finite,
  })
).index("by_userId_and_setIdentity", ["userId", "setIdentity"]);
