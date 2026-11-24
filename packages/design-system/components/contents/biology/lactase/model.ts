import { Schema } from "effect";

export const LactaseMethodSchema = Schema.Literals(["immobilised", "free"]);
export type LactaseMethod = typeof LactaseMethodSchema.Type;

const ColumnOutcomeSchema = Schema.Struct({
  batches: Schema.Int,
  enzymeInMilk: Schema.Boolean,
  glucosePositive: Schema.Boolean,
  lactoseRemaining: Schema.Finite,
});
export type ColumnOutcome = typeof ColumnOutcomeSchema.Type;

/**
 * Evaluates lactose hydrolysis, glucose strip response, enzyme contamination
 * in effluent milk, and reusable batches for immobilised beads vs free enzyme.
 */
export function evaluateColumn(
  method: LactaseMethod,
  flowRate: number
): ColumnOutcome {
  if (method === "free") {
    return {
      batches: 1,
      enzymeInMilk: true,
      glucosePositive: true,
      lactoseRemaining: 4,
    };
  }
  const contact = 1 / (1 + flowRate / 4.5);
  const hydrolysis = Math.min(0.96, Math.max(0.08, contact * 1.18));
  const lactoseRemaining = Math.round((1 - hydrolysis) * 100);
  return {
    batches: 12,
    enzymeInMilk: false,
    glucosePositive: lactoseRemaining < 85,
    lactoseRemaining,
  };
}
