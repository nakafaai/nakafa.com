import { Schema } from "effect";
export const tryoutScoreStatusValidator = Schema.Literals([
  "provisional",
  "official",
]);
export const tryoutScoringStrategyValidator = Schema.Literals([
  "irt",
  "raw",
  "weighted",
]);
export type TryoutScoringStrategy = Schema.Schema.Type<
  typeof tryoutScoringStrategyValidator
>;
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
export type TryoutSectionScore = Schema.Schema.Type<
  typeof tryoutSectionScoreValidator
>;
export const tryoutScoreResultValidator = Schema.Struct({
  ...tryoutScoreValueValidators,
  totalCorrect: Schema.Finite,
  totalQuestions: Schema.Finite,
});
export type TryoutScoreResult = Schema.Schema.Type<
  typeof tryoutScoreResultValidator
>;
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
