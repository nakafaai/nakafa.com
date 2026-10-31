import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { jointCeiling } from "@nakafa/aksara-contracts/assessment/joint";
import type { ScoringRule } from "@nakafa/aksara-contracts/assessment/scoring";
import { grade } from "@repo/backend/confect/assessment/grade";
import {
  chosenOptions,
  type ExamResponse,
} from "@repo/backend/confect/assessment/response";
import type { QuestionView } from "@repo/backend/confect/exams/question";
import {
  gradeVerdict,
  type Verdict,
} from "@repo/backend/confect/exams/results/schema";
import {
  ALL_OR_NOTHING,
  ANSWER_AND_REASON,
} from "@repo/backend/confect/exams/scoring";
import { Array as Arr, Option } from "effect";

/** What one answer scored: the whole points it earned, and the verdict they give. */
interface Scored {
  readonly points: number;
  readonly verdict: Verdict;
}

/** An answer that waits for a person, which has earned nothing yet. */
const WAITING: Scored = { points: 0, verdict: "pending" };

/** A question as the scoring reads it. */
type ScoredQuestion = Pick<
  QuestionView,
  "answers" | "key" | "points" | "scoring"
>;

/**
 * What a category earns: its share of the question's points, in whole points and rounded down, so only a whole
 * answer earns them all, and the verdict they give, as a teacher's grade does (`gradeVerdict`).
 */
const shareOf = (category: number, ceiling: number, points: number): Scored => {
  const earned = Math.floor((category * points) / ceiling);
  return { points: earned, verdict: gradeVerdict(earned, points) };
};

/** Grades one interaction by a rule, with the key's answer for it. */
const gradeOne = (
  interaction: Interaction,
  key: readonly InteractionKey[],
  response: ExamResponse,
  rule: ScoringRule
) =>
  grade({
    interaction,
    key: Option.getOrUndefined(
      Arr.findFirst(key, (answer) => answer.interaction === interaction.id)
    ),
    response,
    rule,
  });

/** The part of a response that answers one interaction: a choice reads its own options among all the paper's. */
const ownResponse = (
  interaction: Interaction,
  response: ExamResponse
): ExamResponse =>
  interaction.kind === "choice"
    ? Arr.filter(chosenOptions(response), (id) =>
        Arr.some(interaction.options, (option) => option.id === id)
      )
    : response;

/**
 * Scores the choices of a two-tier question as one (`ANSWER_AND_REASON`): the first level whose interactions are
 * all right gives the category, and none gives nothing. A question without a key waits for a person.
 */
const scoreJoint = (
  { answers, key, points }: ScoredQuestion,
  response: ExamResponse
): Scored => {
  if (key === null) {
    return WAITING;
  }
  const right = Arr.filter(answers, (interaction) => {
    const graded = gradeOne(
      interaction,
      key,
      ownResponse(interaction, response),
      ALL_OR_NOTHING
    );
    return graded.status === "scored" && graded.category === graded.ceiling;
  });
  const level = Arr.findFirst(ANSWER_AND_REASON.levels, ({ correct }) =>
    Arr.every(correct, (id) =>
      Arr.some(right, (interaction) => interaction.id === id)
    )
  );
  return shareOf(
    Option.match(level, { onNone: () => 0, onSome: ({ points }) => points }),
    jointCeiling(ANSWER_AND_REASON),
    points
  );
};

/**
 * Scores one saved response against its question with the shared grader (`grade`), by the question's own
 * rule. An unanswered question earns nothing and is `incorrect`, as the sitting closes it. A question of two
 * interactions is an answer and its reason, scored as one (`scoreJoint`). A question without a key that a
 * person has not judged, a written essay, a typed text that no accepted answer matches, and a key with no
 * answer for the interaction wait for a person (ADR 0031, section 4).
 */
export function scoreResponse(
  question: ScoredQuestion,
  response: ExamResponse
): Scored {
  const { answers, key, points, scoring } = question;
  if (answers.length > 1) {
    return scoreJoint(question, response);
  }
  const interaction = Arr.headNonEmpty(answers);
  if (key === null && interaction.kind !== "extendedText") {
    return WAITING;
  }
  const graded = gradeOne(interaction, key ?? [], response, scoring);
  return graded.status === "pending"
    ? WAITING
    : shareOf(graded.category, graded.ceiling, points);
}
