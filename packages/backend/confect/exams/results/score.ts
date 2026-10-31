import { grade } from "@repo/backend/confect/assessment/grade";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import type { QuestionView } from "@repo/backend/confect/exams/question";
import {
  examResultValidator,
  gradeVerdict,
} from "@repo/backend/confect/exams/results/schema";
import { Array as Arr, Option, Struct } from "effect";

/** What one answer scored: the whole points it earned, and the verdict they give. */
const Scored = examResultValidator.mapFields(
  Struct.pick(["points", "verdict"])
);
type Scored = typeof Scored.Type;

/** An answer that waits for a person, which has earned nothing yet. */
const WAITING: Scored = { points: 0, verdict: "pending" };

/**
 * Scores one saved response against its question with the shared grader (`grade`), by the question's own
 * rule. A question holds one interaction, and a question of any other shape is `pending`, as is a question
 * without a key that a person has not judged. A graded answer earns its share of the question's points, in
 * whole points and rounded down, so only an answer with every part right earns them all, and its verdict
 * follows them as a teacher's grade does (`gradeVerdict`): an unanswered question earns nothing and is
 * `incorrect`, as the sitting closes it. A written essay, a typed text that no accepted answer matches, and a
 * key with no answer for the interaction wait for a person (ADR 0031, section 4).
 */
export function scoreResponse(
  question: Pick<QuestionView, "answers" | "key" | "points" | "scoring">,
  response: ExamResponse
): Scored {
  const { answers, key, points, scoring } = question;
  if (answers.length > 1) {
    return WAITING;
  }
  const interaction = Arr.headNonEmpty(answers);
  if (key === null && interaction.kind !== "extendedText") {
    return WAITING;
  }
  const graded = grade({
    interaction,
    key: Option.getOrUndefined(
      Arr.findFirst(
        key ?? [],
        (answer) => answer.interaction === interaction.id
      )
    ),
    response,
    rule: scoring,
  });
  if (graded.status === "pending") {
    return WAITING;
  }
  const earned = Math.floor((graded.category * points) / graded.ceiling);
  return { points: earned, verdict: gradeVerdict(earned, points) };
}
