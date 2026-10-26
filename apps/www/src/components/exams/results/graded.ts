import type {
  AnswerRow,
  AttemptResult,
} from "@repo/backend/confect/exams/results/contract";
import { gradeVerdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr, Number as Num } from "effect";

/**
 * The answers of a question's page once the teacher grades one of them: that student's answer earns
 * the points, and its verdict follows them as the server decides it (`gradeVerdict`). Every other
 * answer stays as it was.
 */
export const gradedPage = (
  page: readonly (typeof AnswerRow.Type)[],
  grade: {
    readonly attemptId: (typeof AnswerRow.Type)["attemptId"];
    readonly points: number;
    readonly weight: number;
  }
): (typeof AnswerRow.Type)[] =>
  Arr.map(page, (answer) =>
    answer.attemptId === grade.attemptId
      ? {
          ...answer,
          points: grade.points,
          verdict: gradeVerdict(grade.points, grade.weight),
        }
      : answer
  );

/**
 * One student's answers once the teacher grades one of them: that question's answer earns the points,
 * its verdict follows them as the server decides it (`gradeVerdict`), and the attempt's points are the
 * sum again. Every other answer stays as it was.
 */
export const gradedAttempt = (
  result: typeof AttemptResult.Type,
  grade: {
    readonly points: number;
    readonly questionId: (typeof AttemptResult.Type)["questions"][number]["id"];
  }
): typeof AttemptResult.Type => {
  const questions = Arr.map(result.questions, (question) =>
    question.id === grade.questionId
      ? {
          ...question,
          earned: grade.points,
          verdict: gradeVerdict(grade.points, question.points),
        }
      : question
  );
  return {
    ...result,
    points: Num.sumAll(Arr.map(questions, (question) => question.earned)),
    questions,
  };
};
