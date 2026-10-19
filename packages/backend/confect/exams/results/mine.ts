import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import {
  attemptOf,
  sittingOf,
} from "@repo/backend/confect/exams/sittings/attempt";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Number as Num, Option } from "effect";

/**
 * The student's own result in one sitting, once the teacher releases it: the points that the attempt
 * earned, and the verdict of each question in the exam's order. A student sees nothing before the release,
 * and nothing for an attempt that is not submitted. A student who holds no attempt gets `null`.
 */
export const mine = Effect.fn("exams.results.mine")(function* (args: {
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const sitting = yield* sittingOf(args.sittingId, member.tenant._id);
  const held = yield* attemptOf(sitting._id, member.person._id);
  if (
    Option.isNone(held) ||
    held.value.state !== "submitted" ||
    sitting.resultsReleasedAt === undefined
  ) {
    return null;
  }
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  const rows = yield* attemptResults(sitting._id, member.person._id);
  return {
    points: Num.sumAll(Arr.map(rows, (row) => row.points)),
    questions: Arr.flatMap(exam.questions, (questionId, index) =>
      Arr.map(
        Arr.filter(rows, (row) => row.question === questionId),
        (row) => ({ number: index + 1, verdict: row.verdict })
      )
    ),
  };
});
