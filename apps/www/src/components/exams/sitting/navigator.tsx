"use client";

import { Array as Arr } from "effect";
import { useFlags } from "@/components/exams/sitting/flags.client";
import type { PaperQuestion } from "@/components/exams/sitting/paper";
import { PlayerGrid } from "@/components/player/navigator/grid";

/** A question has a response once the student saved at least one option of it. */
function isAnswered(question: PaperQuestion) {
  return question.response !== null && question.response.length > 0;
}

/**
 * The navigator of the paper: every question's number, in the paper's order. A click goes to that
 * question, and a flagged question carries its flag. The answered state follows the paper, so an answer
 * shows here as soon as the student chooses it.
 */
export function SittingNavigator({
  questions,
}: {
  readonly questions: readonly PaperQuestion[];
}) {
  const flagged = useFlags((state) => state.flagged);

  return (
    <PlayerGrid
      questions={Arr.map(questions, (question) => ({
        answered: isAnswered(question),
        flagged: Arr.contains(flagged, question.id),
        key: question.id,
      }))}
    />
  );
}
