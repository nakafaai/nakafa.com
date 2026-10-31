import { matchesAnswerKey } from "@nakafa/aksara-contracts/assessment/answer";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  pointsForWrongParts,
  type ScoringRule,
  scoreCeiling,
} from "@nakafa/aksara-contracts/assessment/scoring";
import {
  chosenOptions,
  type ExamResponse,
  isAnswered,
  isTextResponse,
  madePairs,
  markedCells,
} from "@repo/backend/confect/assessment/response";
import { Array as Arr, Match, Schema } from "effect";

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * How one response to one interaction scores. `scored` holds the score category, from 0 to the
 * ceiling, the most points its rule awards (`scoreCeiling`). `pending` waits for a person: a written
 * text, a typed text that no accepted answer matches, a rubric, an interaction without a key, or a kind
 * the grader does not read. It keeps the ceiling, so a total knows what is still open.
 */
export const Grade = Schema.Union([
  Schema.Struct({
    category: NonNegativeInt,
    ceiling: NonNegativeInt,
    status: Schema.Literal("scored"),
  }),
  Schema.Struct({ ceiling: NonNegativeInt, status: Schema.Literal("pending") }),
]);
export type Grade = typeof Grade.Type;

/**
 * The parts of a keyed response: how many parts the key defines, how many of them the response gets
 * right, and how many values the response holds that no part of the key holds.
 */
const Parts = Schema.Struct({
  correct: NonNegativeInt,
  extra: NonNegativeInt,
  total: NonNegativeInt,
});
type Parts = typeof Parts.Type;

/**
 * Counts the parts of a choice, a table, or a match. The parts are the ones the key defines, as the
 * contract's rules count them: the correct options of a choice, the statements of a table, and the
 * pairs of a match. A response gets a part right when it holds it, and every other value it holds, an
 * option outside the key, a statement marked with another column, a pair outside the key, or a part it
 * names again, is extra. Any other key is one part.
 */
const countParts = (key: InteractionKey, response: ExamResponse): Parts =>
  Match.value(key).pipe(
    Match.when({ kind: "choice" }, ({ correct }) => {
      const chosen = chosenOptions(response);
      const right = Arr.filter(correct, (id) =>
        Arr.contains(chosen, id)
      ).length;
      return {
        correct: right,
        extra: chosen.length - right,
        total: correct.length,
      };
    }),
    Match.when({ kind: "matrix" }, ({ answers }) => {
      const marked = markedCells(response);
      const right = Arr.filter(answers, (answer) =>
        Arr.some(
          marked,
          (cell) =>
            cell.statement === answer.statement && cell.column === answer.column
        )
      ).length;
      return {
        correct: right,
        extra: marked.length - right,
        total: answers.length,
      };
    }),
    Match.when({ kind: "match" }, ({ pairs }) => {
      const made = madePairs(response);
      const right = Arr.filter(pairs, (answer) =>
        Arr.some(
          made,
          (pair) =>
            pair.source === answer.source && pair.target === answer.target
        )
      ).length;
      return {
        correct: right,
        extra: made.length - right,
        total: pairs.length,
      };
    }),
    Match.orElse(() => ({ correct: 0, extra: 0, total: 1 }))
  );

/**
 * Scores counted parts by a rule. All or nothing is 1 for every part right and nothing extra. Per part
 * earns its points for each part right, loses its penalty for each extra value, and stays between the
 * floor and the ceiling. Wrong parts takes the points of the first band that holds the parts the
 * response misses plus the values it adds. A rubric is a person's to score.
 */
const scoreParts = (rule: ScoringRule, parts: Parts): Grade => {
  const ceiling = scoreCeiling(rule, parts.total);
  return Match.value(rule).pipe(
    Match.discriminatorsExhaustive("kind")({
      allOrNothing: (): Grade => ({
        category: parts.correct === parts.total && parts.extra === 0 ? 1 : 0,
        ceiling,
        status: "scored",
      }),
      perPart: ({ floor, penaltyPerWrongPart, pointsPerPart }): Grade => ({
        category: Math.min(
          ceiling,
          Math.max(
            floor,
            parts.correct * pointsPerPart -
              parts.extra * (penaltyPerWrongPart ?? 0)
          )
        ),
        ceiling,
        status: "scored",
      }),
      rubric: (): Grade => ({ ceiling, status: "pending" }),
      wrongParts: (bands): Grade => ({
        category: pointsForWrongParts(
          bands,
          parts.total - parts.correct + parts.extra
        ),
        ceiling,
        status: "scored",
      }),
    })
  );
};

/**
 * Grades one response to one interaction by its rule. `key` is the key's answer for the interaction,
 * none when the key holds no answer for it. An unanswered interaction scores 0 under every rule. A choice, a table, and a match score their
 * parts (`scoreParts`). A text entry is one part: an answer that one accepted answer matches after the
 * contract's normalization (`matchesAnswerKey`) scores the ceiling, and any other answer waits for a
 * person. A text key compares normalized text and reads no language, so every delivery language grades
 * it the same. A written text, an interaction without a key, and every other kind wait for a person.
 */
export function grade({
  interaction,
  key,
  response,
  rule,
}: {
  interaction: Interaction;
  key: InteractionKey | undefined;
  response: ExamResponse;
  rule: ScoringRule;
}): Grade {
  const keyed = key !== undefined && key.interaction === interaction.id;
  const parts = keyed ? countParts(key, response) : undefined;
  const ceiling = scoreCeiling(rule, parts?.total ?? 1);
  if (!isAnswered(response)) {
    return { category: 0, ceiling, status: "scored" };
  }
  if (!keyed) {
    return { ceiling, status: "pending" };
  }
  if (key.kind === "textEntry") {
    return isTextResponse(response) &&
      matchesAnswerKey(key.accepted, response.text)
      ? { category: ceiling, ceiling, status: "scored" }
      : { ceiling, status: "pending" };
  }
  if (
    parts !== undefined &&
    (key.kind === "choice" || key.kind === "matrix" || key.kind === "match")
  ) {
    return scoreParts(rule, parts);
  }
  return { ceiling, status: "pending" };
}
