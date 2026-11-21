import { Table } from "@confect/core";
import { ItemFamilyIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { PlacedVersionSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { placedQuestionFields } from "@repo/backend/confect/tryouts/runtime/question";
import { Schema } from "effect";

/**
 * One place of an attempt's paper, frozen when the attempt starts: its item family and its version in
 * each language of its section, in the section's order; and each of its interactions, in the item's order,
 * with the structure of the interaction, the key's answer for it, and the rule that scores it (the item's
 * override, else the profile's default for its kind), as `placedQuestionFields` stores them. The structure
 * holds identifiers, counts, and bounds, never words, so it is the same in every language, and the key
 * accepts the typed answers of every version. Both are stored as JSON text (`runtime/question`). An answer
 * is graded from this row alone, whichever language the learner read, and a version's prompt, labels, and
 * reading are read by its hash when the place is shown (`runtime/version`). The key never leaves the server before the attempt's review.
 */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
    questionOrder: Schema.Finite,
    family: ItemFamilyIdSchema,
    versions: Schema.NonEmptyArray(PlacedVersionSchema),
    ...placedQuestionFields,
    /**
     * The version of the write that cleared the question's answer. Deleting the
     * answer deletes the version it carried, so the placement keeps the number
     * that the next write of the question must exceed.
     */
    clearedVersion: Schema.optionalKey(Version),
  })
)
  .index("by_tryoutAttemptId_and_questionOrder", [
    "tryoutAttemptId",
    "questionOrder",
  ])
  .index("by_tryoutAttemptId_and_sectionKey_and_questionOrder", [
    "tryoutAttemptId",
    "sectionKey",
    "questionOrder",
  ]);
