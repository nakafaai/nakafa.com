import { Table } from "@confect/core";
import { ItemFamilyIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { ScoringRuleSchema } from "@nakafa/aksara-contracts/assessment/scoring";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

/**
 * One place of an attempt's paper, frozen when the attempt starts: the item version the place names,
 * by family and hash, its one interaction and the key's answer for it, and the rule that scores it
 * (the item's override, else the profile's default for its kind). The interaction and the key are
 * stored as JSON text (`runtime/question`), because a document in a label can nest deeper than a
 * Convex object may. An answer is graded from this row alone, and the item's prompt is read by its
 * hash when the place is shown. The key never leaves the server before the attempt's review.
 */
export default Table.make(() =>
  Schema.Struct({
    tryoutAttemptId: IdSchema("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
    questionOrder: Schema.Finite,
    family: ItemFamilyIdSchema,
    versionHash: Sha256HashSchema,
    deliveryLanguage: ContentLanguageSchema,
    interactionJson: Schema.String,
    keyJson: Schema.String,
    rule: ScoringRuleSchema,
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
