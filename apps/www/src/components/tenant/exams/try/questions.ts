import type { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr, Option, Record as Rec } from "effect";
import { pickedOption } from "@/components/exams/sitting/response";
import type { PlayerQuestionModel } from "@/components/player/model";
import type { Question } from "@/components/tenant/exams/optimistic";
import type { ExamTry } from "@/components/tenant/exams/try/store";

/**
 * The exam's questions as the shared player marks, flags, and picks them in a teacher's try, the way a
 * sitting projects its paper: a question is answered once the try holds its response, flagged once the
 * try holds its flag, and a digit key picks the option at its index of a single choice.
 */
export function projectTryQuestions(input: {
  readonly questions: readonly Question[];
  readonly try: Pick<ExamTry, "choose" | "flag" | "flags" | "responses">;
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.questions, (question) => ({
    answered: Rec.has(input.try.responses, question.id),
    flag: () => input.try.flag(question.id),
    flagged: Rec.has(input.try.flags, question.id),
    key: question.id,
    pick: (index) =>
      Option.match(pickedOption(question.answers, index), {
        onNone: () => false,
        onSome: (optionId) => {
          const response: ExamResponse = [optionId];
          input.try.choose(question.id, response);
          return true;
        },
      }),
  }));
}
