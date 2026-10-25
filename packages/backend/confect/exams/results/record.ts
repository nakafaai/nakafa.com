import type {
  ExamAttemptsDoc,
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { questionView } from "@repo/backend/confect/exams/question";
import {
  pointsOf,
  scoreResponse,
} from "@repo/backend/confect/exams/results/score";
import { Effect, Option } from "effect";

/**
 * Scores one question of a submitted attempt. The response is the one the attempt saved, and an
 * unanswered question has none, so it scores `incorrect`.
 */
const recordQuestion = Effect.fn("exams.results.record.question")(function* (
  attempt: ExamAttemptsDoc,
  sitting: ExamSittingsDoc,
  questionId: ExamQuestionsDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const question = yield* reader
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const view = yield* questionView(question);
  const saved = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", attempt._id).eq("question", questionId)
    )
    .first()
    .pipe(Effect.orDie);
  const response = Option.match(saved, {
    onNone: () => [],
    onSome: (answer) => answer.response,
  });
  const verdict = scoreResponse(view.answers, view.key, response);
  yield* (yield* DatabaseWriter)
    .table("examResults")
    .insert({
      attempt: attempt._id,
      person: attempt.person,
      points: pointsOf(verdict),
      question: questionId,
      response,
      sitting: sitting._id,
      tenantId: attempt.tenantId,
      verdict,
    })
    .pipe(Effect.orDie);
});

/**
 * Scores a submitted attempt: one result row for each question of its sitting's exam, written in the
 * caller's transaction with the submission. The callers run it only when the attempt moves to
 * submitted, and submitted is final, so a retried submission writes no second row (ADR 0031, section 8).
 */
export const recordResults = Effect.fn("exams.results.record")(function* (
  attempt: ExamAttemptsDoc,
  sitting: ExamSittingsDoc
) {
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  yield* Effect.forEach(exam.questions, (questionId) =>
    recordQuestion(attempt, sitting, questionId)
  );
});
