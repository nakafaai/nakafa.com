import { Table } from "@confect/core";
import { ItemFamilyIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { PlacedVersionSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ScoringRuleSchema } from "@nakafa/aksara-contracts/assessment/scoring";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * One question of a practice session, frozen when the session started as a try-out's placement is: the
 * item family and its version in each language of its section, its interaction and the key's answer as
 * JSON text (`runtime/question`), and the rule that grades it. The session reads it in its one language
 * (`practiceSessions.questionLanguage`). A check grades from this row alone, and the key leaves the server only with
 * a checked question's verdict, to a reader who may read it.
 */
export default Table.make(() =>
  Schema.Struct({
    practiceSessionId: IdSchema("practiceSessions"),
    questionOrder: Schema.Finite,
    family: ItemFamilyIdSchema,
    versions: Schema.NonEmptyArray(PlacedVersionSchema),
    interactionJson: Schema.String,
    keyJson: Schema.String,
    rule: ScoringRuleSchema,
  })
).index("by_practiceSessionId_and_questionOrder", [
  "practiceSessionId",
  "questionOrder",
]);
