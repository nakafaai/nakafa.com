import type {
  ExamQuestionsDoc,
  ExamResultsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { questionView } from "@repo/backend/confect/exams/question";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { questionResults } from "@repo/backend/confect/exams/results/rows";
import {
  optionIdsOf,
  tallyAnswers,
} from "@repo/backend/confect/exams/results/stats";
import { QuestionNotInExam } from "@repo/backend/confect/exams/sittings/errors";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Struct } from "effect";

/** The most answers that one page of a question's list holds. A larger request is clamped to it. */
const ANSWER_PAGE_SIZE = 100;

/**
 * The most answers that a question's statistics count: the most students that one sitting holds
 * (K26), so the read is bounded by the sitting's design size. A sitting with more answers reports
 * `complete: false` rather than counting a partial page as the whole.
 */
const STATS_LIMIT = 3000;

/** One scored answer of a question, with the name of the student who gave it. */
const answerRow = Effect.fn("exams.results.questions.answer")(function* (
  row: ExamResultsDoc
) {
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(row.person)
    .pipe(Effect.orDie);
  return {
    attemptId: row.attempt,
    name: person.name,
    points: row.points,
    response: row.response,
    verdict: row.verdict,
  };
});

/**
 * One page of a question's answers across the sitting, one for each student who was scored on it. A
 * page asks for at most `ANSWER_PAGE_SIZE` answers, and a larger request is clamped to that size.
 */
export const byQuestion = Effect.fn("exams.results.questions.page")(
  function* (args: {
    paginationOpts: PaginationOptions;
    questionId: ExamQuestionsDoc["_id"];
  }) {
    const sitting = yield* ResultSitting;
    const page = yield* (yield* DatabaseReader)
      .table("examResults")
      .index("by_sittingId_and_questionId", (query) =>
        query.eq("sitting", sitting._id).eq("question", args.questionId)
      )
      .paginate(
        Struct.assign(args.paginationOpts, {
          numItems: Num.clamp(args.paginationOpts.numItems, {
            maximum: ANSWER_PAGE_SIZE,
            minimum: 1,
          }),
        })
      )
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(page.page, answerRow, {
      concurrency: "unbounded",
    });
    return Struct.assign(page, { page: rows });
  }
);

/**
 * The statistics of one question across the sitting: its correct, incorrect, and pending answers, and
 * how many answers chose each option. A question that the exam does not hold is refused, so the reply
 * names no option of another exam.
 */
export const questionStats = Effect.fn("exams.results.questions.stats")(
  function* (args: { questionId: ExamQuestionsDoc["_id"] }) {
    const sitting = yield* ResultSitting;
    const reader = yield* DatabaseReader;
    const exam = yield* reader
      .table("exams")
      .get(sitting.examId)
      .pipe(Effect.orDie);
    if (!Arr.contains(exam.questions, args.questionId)) {
      return yield* new QuestionNotInExam();
    }
    const question = yield* reader
      .table("examQuestions")
      .get(args.questionId)
      .pipe(Effect.orDie);
    const view = yield* questionView(question);
    const rows = yield* questionResults(
      sitting._id,
      args.questionId,
      STATS_LIMIT + 1
    );
    const counted = Arr.take(rows, STATS_LIMIT);
    return {
      ...tallyAnswers(counted, optionIdsOf(view.answers)),
      complete: rows.length <= STATS_LIMIT,
      counted: counted.length,
    };
  }
);
