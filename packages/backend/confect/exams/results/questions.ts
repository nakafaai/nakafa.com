import type {
  ExamQuestionsDoc,
  ExamResultsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { questionView } from "@repo/backend/confect/exams/question";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { namedPeople } from "@repo/backend/confect/exams/results/named";
import {
  personResult,
  questionResults,
} from "@repo/backend/confect/exams/results/rows";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import {
  optionIdsOf,
  tallyAnswers,
} from "@repo/backend/confect/exams/results/stats";
import { QuestionNotInExam } from "@repo/backend/confect/exams/sittings/errors";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Option, Struct } from "effect";

/** The most answers that one page of a question's list holds. A larger request is clamped to it. */
const ANSWER_PAGE_SIZE = 100;

/**
 * The most answers that a question's statistics count: the most students that one sitting holds
 * (K26), so the read is bounded by the sitting's design size. A sitting with more answers reports
 * `complete: false` rather than counting a partial page as the whole.
 */
const STATS_LIMIT = 3000;

/** One scored answer of a question, with the name of the student who gave it. */
const answerRow = (row: ExamResultsDoc, person: TenantPeopleDoc) => ({
  attemptId: row.attempt,
  name: person.name,
  points: row.points,
  response: row.response,
  verdict: row.verdict,
});

/** The answer of a row that the list read by its index, with the student's name read beside it. */
const resultRow = Effect.fn("exams.results.questions.answer")(function* (
  row: ExamResultsDoc
) {
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(row.person)
    .pipe(Effect.orDie);
  return answerRow(row, person);
});

/**
 * The answer of one person whose name a search matched: the person's scored answer to the question, or
 * none when the person was not scored on it, or was scored with another verdict than the `verdict` the
 * list keeps.
 */
const personAnswer = Effect.fn("exams.results.questions.person")(function* (
  sittingId: ExamSittingsDoc["_id"],
  questionId: ExamQuestionsDoc["_id"],
  person: TenantPeopleDoc,
  verdict: Verdict | undefined
) {
  return Option.map(
    Option.filter(
      yield* personResult(sittingId, person._id, questionId),
      (row) => verdict === undefined || row.verdict === verdict
    ),
    (row) => answerRow(row, person)
  );
});

/**
 * One page of a question's scored rows across the sitting, in their verdicts' order: every row, or only
 * the rows of one verdict.
 */
const resultPage = Effect.fn("exams.results.questions.rows")(function* (
  sittingId: ExamSittingsDoc["_id"],
  questionId: ExamQuestionsDoc["_id"],
  paginationOpts: PaginationOptions,
  verdict: Verdict | undefined
) {
  return yield* (yield* DatabaseReader)
    .table("examResults")
    .index("by_sittingId_and_questionId_and_verdict", (query) => {
      const ofQuestion = query
        .eq("sitting", sittingId)
        .eq("question", questionId);
      return verdict === undefined
        ? ofQuestion
        : ofQuestion.eq("verdict", verdict);
    })
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
});

/**
 * One page of a question's answers across the sitting, one for each student who was scored on it, in
 * their verdicts' order. A page asks for at most `ANSWER_PAGE_SIZE` answers, and a larger request is
 * clamped to that size. A `verdict` reads only the answers of that verdict. A `search` reads the
 * school's people whose names match it, best match first (`namedPeople`), and keeps those who were
 * scored on the question, so a page of a search can hold fewer answers than it read.
 */
export const byQuestion = Effect.fn("exams.results.questions.page")(
  function* (args: {
    paginationOpts: PaginationOptions;
    questionId: ExamQuestionsDoc["_id"];
    search?: string;
    verdict?: Verdict;
  }) {
    const sitting = yield* ResultSitting;
    const paginationOpts = Struct.assign(args.paginationOpts, {
      numItems: Num.clamp(args.paginationOpts.numItems, {
        maximum: ANSWER_PAGE_SIZE,
        minimum: 1,
      }),
    });
    if (args.search !== undefined) {
      const people = yield* namedPeople(
        sitting.tenantId,
        args.search,
        paginationOpts
      );
      const rows = yield* Effect.forEach(
        people.page,
        (person) =>
          personAnswer(sitting._id, args.questionId, person, args.verdict),
        { concurrency: "unbounded" }
      );
      return Struct.assign(people, { page: Arr.getSomes(rows) });
    }
    const page = yield* resultPage(
      sitting._id,
      args.questionId,
      paginationOpts,
      args.verdict
    );
    const rows = yield* Effect.forEach(page.page, resultRow, {
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
