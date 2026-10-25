import { Array as Arr } from "effect";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import { PlayerGrid } from "@/components/player/navigator/grid";

/** A question has a response once the student saved at least one option of it. */
function isAnswered(question: PaperQuestion) {
  return question.response !== null && question.response.length > 0;
}

/**
 * The navigator of the paper: every question's number, in the paper's order. A click goes to that
 * question, and a flagged question carries its flag. The answered and flagged states follow the paper, so an
 * answer or a flag shows here as soon as the student makes it.
 */
export function SittingNavigator({
  questions,
}: {
  readonly questions: readonly PaperQuestion[];
}) {
  return (
    <PlayerGrid
      questions={Arr.map(questions, (question) => ({
        answered: isAnswered(question),
        flagged: question.flagged,
        key: question.id,
      }))}
    />
  );
}
