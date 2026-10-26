import type { AnswerRow } from "@repo/backend/confect/exams/results/contract";
import { gradeVerdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr } from "effect";

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
