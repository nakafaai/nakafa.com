import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Array as Arr, HashMap, Option } from "effect";
import type { PlayerQuestionModel } from "@/components/player/model";
import { projectQuestions } from "@/components/player/model";
import type { TryoutBody } from "@/components/tryout/content/body";
import { isAnsweredQuestion } from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * Projects the questions of a running section into what the player marks in its navigator, flags, and picks
 * from the keyboard. A question counts as answered as the server counts it. A digit key picks from the
 * interactions of the question's body, so a question whose body has not arrived offers none, and answers through
 * the same save that its response fields use; a flag goes through the flag save, which turns it the other way.
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
      // Every language of a question holds the same options, so a digit picks from the first.
      (body) =>
        [
          body.placementId,
          Arr.headNonEmpty(body.versions).interactions,
        ] as const
    )
  );
  return projectQuestions({
    answer: input.answer,
    cell: (question) => ({
      answered: isAnsweredQuestion(question),
      flagged: question.flagged,
      key: question.placementId,
    }),
    flag: (question) => input.flag(question, !question.flagged),
    interactions: (question) =>
      Option.getOrElse(
        HashMap.get(interactions, question.placementId),
        () => []
      ),
    questions: input.questions,
  });
}
