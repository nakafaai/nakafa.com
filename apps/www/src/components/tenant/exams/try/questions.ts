import { paperAnswers } from "@repo/backend/confect/exams/parts";
import { Record as Rec } from "effect";
import {
  type PlayerQuestionModel,
  projectQuestions,
} from "@/components/player/model";
import type { Question } from "@/components/tenant/exams/optimistic";
import type { ExamTry } from "@/components/tenant/exams/try/store";

/**
 * The exam's questions as the shared player marks, flags, and picks them in a teacher's try, the way a
 * sitting projects its paper: a question is answered once the try holds its response, flagged once the
 * try holds its flag, and a digit key picks among the options the paper shows (`paperAnswers`).
 */
export function projectTryQuestions(input: {
  readonly questions: readonly Question[];
  readonly try: Pick<ExamTry, "choose" | "flag" | "flags" | "responses">;
}): readonly PlayerQuestionModel[] {
  return projectQuestions({
    answer: (question, response) => input.try.choose(question.id, response),
    cell: (question) => ({
      answered: Rec.has(input.try.responses, question.id),
      flagged: Rec.has(input.try.flags, question.id),
      key: question.id,
    }),
    flag: (question) => input.try.flag(question.id),
    interactions: (question) => paperAnswers(question.answers),
    questions: input.questions,
  });
}
