import {
  type DefaultRuleSchema,
  scoreCeiling,
} from "@nakafa/aksara-contracts/assessment/scoring";
import type {
  QuestionPoints,
  QuestionTemplate,
} from "@repo/backend/confect/exams/question";
import { Match, Schema } from "effect";

/** A rule that one question of an exam scores by: a rule of the contract, a rubric aside, which an essay holds. */
type QuestionRule = typeof DefaultRuleSchema.Type;

/** The rule a teacher chooses for a question, by the name the contract gives its kind. */
export const ScoringKind = Schema.Literals([
  "allOrNothing",
  "perPart",
  "wrongParts",
]);
export type ScoringKind = typeof ScoringKind.Type;

/** The rule of a question no teacher set: every part right earns the points, as the try-outs' profiles score. */
export const ALL_OR_NOTHING: QuestionRule = { kind: "allOrNothing" };

/** Each right part earns its share, each wrong value takes one back, and the score stays at none or more. */
const PER_PART: QuestionRule = {
  floor: 0,
  kind: "perPart",
  penaltyPerWrongPart: 1,
  pointsPerPart: 1,
};

/** The AKM rule of a complex choice: 2 with no wrong part, 1 with one or two, and 0 with more (ADR 0031, section 4). */
const AKM_BANDS: QuestionRule = {
  bands: [
    { points: 2, wrong: 0 },
    { points: 1, wrong: 2 },
  ],
  kind: "wrongParts",
};

/** The rule of a kind. A question stores the rule itself, so a later change of a rule leaves it as it was. */
export const scoringRule = (kind: ScoringKind): QuestionRule =>
  Match.value(kind).pipe(
    Match.when("allOrNothing", () => ALL_OR_NOTHING),
    Match.when("perPart", () => PER_PART),
    Match.when("wrongParts", () => AKM_BANDS),
    Match.exhaustive
  );

/**
 * Whether a template's answer has parts to score one by one: the options of a complex choice, the statements
 * of a table, and the pairs of a match. Every other template is right or wrong as a whole, or a teacher's to
 * judge, so its question scores all or nothing whatever it stored, and a rule never gives a wrong answer points.
 */
export const takesScoring = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("choice", () => false),
    Match.when("choices", () => true),
    Match.when("truefalse", () => false),
    Match.when("cause", () => false),
    Match.when("short", () => false),
    Match.when("numeric", () => false),
    Match.when("essay", () => false),
    Match.when("match", () => true),
    Match.when("table", () => true),
    Match.exhaustive
  );

/** The fewest points a question of this rule holds, so the rule's lowest step is a whole point to earn. */
export const scoringPoints = (
  points: typeof QuestionPoints.Type,
  rule: QuestionRule
) => Math.max(points, scoreCeiling(rule, 1));
