import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ScoringRule } from "@nakafa/aksara-contracts/assessment/scoring";
import { grade } from "@repo/backend/confect/assessment/grade";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import type { QuestionPoints } from "@repo/backend/confect/exams/question";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr, Option } from "effect";

/** A school exam scores each question all or nothing, as the try-outs' profiles do (ADR 0031, section 9). */
const ALL_OR_NOTHING: ScoringRule = { kind: "allOrNothing" };

/**
 * Scores one saved response against its question's key with the shared grader (`grade`). A question
 * holds one interaction, and a question of any other shape is `pending`, as is a question without a
 * key that a person has not judged. A response the grader scores is `correct` when it earns every
 * point and `incorrect` otherwise, so an unanswered question is `incorrect`, as the sitting closes it.
 * A written essay, a typed text that no accepted answer matches, and a key with no answer for the
 * interaction wait for a person, so they are `pending` (ADR 0031, section 4).
 */
export function scoreResponse(
  interactions: readonly Interaction[],
  key: readonly InteractionKey[] | null,
  response: ExamResponse
): Verdict {
  if (!Arr.isReadonlyArrayNonEmpty(interactions) || interactions.length > 1) {
    return "pending";
  }
  const interaction = Arr.headNonEmpty(interactions);
  if (key === null && interaction.kind !== "extendedText") {
    return "pending";
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
    rule: ALL_OR_NOTHING,
  });
  if (graded.status === "pending") {
    return "pending";
  }
  return graded.category === graded.ceiling ? "correct" : "incorrect";
}

/**
 * The points that one verdict earns: a correct answer earns the weight of its question, and no other
 * verdict earns any. The points of an attempt add up to its score.
 */
export const pointsOf = (
  verdict: Verdict,
  weight: typeof QuestionPoints.Type
): number => (verdict === "correct" ? weight : 0);
