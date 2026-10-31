import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Array as Arr, HashMap, Option } from "effect";
import { pickedOption } from "@/components/exams/sitting/response";
import type { PlayerQuestionModel } from "@/components/player/model";
import type { TryoutBody } from "@/components/tryout/content/body";
import { isAnsweredQuestion } from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * Projects the questions of a running section into what the player marks in
 * its navigator, flags, and picks from the keyboard. A question counts as
 * answered as the server counts it. A number key picks the option at that
 * place of a choice that takes one option, read from the question's body, and
 * answers through the same save that its response fields use; it flags through
 * the flag save, which turns its flag the other way.
 */
export function projectTryoutQuestions(input: {
  answer: (
    question: TryoutRuntimeQuestion,
    response: ExamResponse | null
  ) => void;
  bodies: readonly TryoutBody[];
  flag: (question: TryoutRuntimeQuestion, flagged: boolean) => void;
  questions: readonly TryoutRuntimeQuestion[];
}): readonly PlayerQuestionModel[] {
  const interactions = HashMap.fromIterable(
    Arr.map(
      input.bodies,
      (body) => [body.placementId, body.interaction] as const
    )
  );
  return Arr.map(input.questions, (question) => ({
    answered: isAnsweredQuestion(question),
    flag: () => input.flag(question, !question.flagged),
    flagged: question.flagged,
    key: question.placementId,
    pick: (index) =>
      Option.match(
        Option.flatMap(
          HashMap.get(interactions, question.placementId),
          (interaction) => pickedOption([interaction], index)
        ),
        {
          onNone: () => false,
          onSome: (optionId) => {
            input.answer(question, [optionId]);
            return true;
          },
        }
      ),
  }));
}
