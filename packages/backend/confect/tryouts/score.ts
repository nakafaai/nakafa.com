import { ScoringStrategySchema } from "@nakafa/aksara-contracts/assessment/scoring";
import { Array as Arr, Schema } from "effect";
export const tryoutScoreStatusValidator = Schema.Literals([
  "provisional",
  "official",
]);
/** The kind of scoring an attempt follows: the kind of its exam profile's strategy. */
export const tryoutScoringStrategyValidator = Schema.Literals(
  Arr.map(ScoringStrategySchema.members, ({ fields }) => fields.kind.literal)
);
const tryoutScoreValueValidators = {
  publishedScore: Schema.Finite,
  rawScore: Schema.Finite,
  scoreStatus: tryoutScoreStatusValidator,
  scoringStrategy: tryoutScoringStrategyValidator,
  theta: Schema.optionalKey(Schema.Finite),
  thetaSE: Schema.optionalKey(Schema.Finite),
};
export const tryoutSectionScoreValidator = Schema.Struct(
  tryoutScoreValueValidators
);
export type TryoutSectionScore = typeof tryoutSectionScoreValidator.Type;
export const tryoutScoreResultValidator = Schema.Struct({
  ...tryoutScoreValueValidators,
  totalCorrect: Schema.Finite,
  totalQuestions: Schema.Finite,
});
export type TryoutScoreResult = typeof tryoutScoreResultValidator.Type;
/** Expected integrity failure while reading a stored try-out score. */
export class TryoutScoreReadError extends Schema.TaggedError<TryoutScoreReadError>()(
  "TryoutScoreReadError",
  {
    code: Schema.Literals([
      "TRYOUT_SCORE_NOT_FOUND",
      "TRYOUT_SECTION_SCORE_NOT_FOUND",
    ]),
    message: Schema.String,
  }
) {}
/** Loads the immutable attempt score exposed after terminal completion. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
