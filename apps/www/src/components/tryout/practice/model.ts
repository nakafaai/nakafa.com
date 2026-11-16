import type { Ref } from "@confect/core";
import type practice from "@repo/backend/confect/_generated/refs/practice";
import { verdictOf } from "@repo/backend/confect/assessment/verdict";
import { Array as Arr } from "effect";
import type { PlayerReviewCellModel } from "@/components/player/model";

/** A learner's practice of one section, as its state query returns it. */
export type PracticeState = NonNullable<
  Ref.Returns<typeof practice.sessions.state>
>;

/** One question of a practice session. */
export type PracticeQuestion = PracticeState["questions"][number];

/**
 * The numbers of a practice's navigator, in question order: a checked question shows its verdict, and one
 * not checked yet shows as unanswered, so the numbers say how far the learner got and how it went.
 */
export function practiceCellsOf(
  questions: readonly PracticeQuestion[]
): readonly PlayerReviewCellModel[] {
  return Arr.map(questions, ({ answer, questionId }) => ({
    key: questionId,
    shown: true,
    verdict: answer === null ? "unanswered" : verdictOf(answer.grade),
  }));
}

/** How far a practice got: the questions checked, and those checked correct. */
export function practiceProgressOf(questions: readonly PracticeQuestion[]) {
  const checked = Arr.filter(questions, ({ answer }) => answer !== null);
  return {
    checked: checked.length,
    correct: Arr.filter(
      checked,
      ({ answer }) => answer !== null && verdictOf(answer.grade) === "correct"
    ).length,
    total: questions.length,
  };
}
