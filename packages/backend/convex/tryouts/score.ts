import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutScoreStatusValidator = literals("provisional", "official");

export const tryoutScoringStrategyValidator = literals(
  "irt",
  "raw",
  "weighted"
);
export type TryoutScoringStrategy = Infer<
  typeof tryoutScoringStrategyValidator
>;

const tryoutScoreValueValidators = {
  publishedScore: v.number(),
  rawScore: v.number(),
  scoreStatus: tryoutScoreStatusValidator,
  scoringStrategy: tryoutScoringStrategyValidator,
  theta: v.optional(v.number()),
  thetaSE: v.optional(v.number()),
};

export const tryoutSectionScoreValidator = v.object(tryoutScoreValueValidators);
export type TryoutSectionScore = Infer<typeof tryoutSectionScoreValidator>;

export const tryoutScoreResultValidator = v.object({
  ...tryoutScoreValueValidators,
  totalCorrect: v.number(),
  totalQuestions: v.number(),
});
export type TryoutScoreResult = Infer<typeof tryoutScoreResultValidator>;
