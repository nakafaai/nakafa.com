import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  boundAttempt,
  requireOpen,
} from "@repo/backend/confect/exams/sittings/attempt";
import { Array as Arr, Clock, Effect, HashMap, Option, Tuple } from "effect";

/** The saved responses of an attempt, by the question each one answers. */
type Responses = HashMap.HashMap<ExamQuestionsDoc["_id"], readonly string[]>;

/**
 * One question of the paper: its interactions decoded from the question row, and the response
 * that the student saved. The question's answer key is never read, so it never reaches the
 * paper. The prompt is read by `prompt`, one question at a time, so the paper stays small.
 */
const paperQuestion = Effect.fn("exams.sittings.paper.question")(function* (
  questionId: ExamQuestionsDoc["_id"],
  number: number,
  responses: Responses
) {
  const row = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const interactions = yield* questionAnswers(row.answers);
  return {
    id: row._id,
    interactions,
    number,
    response: Option.getOrNull(HashMap.get(responses, questionId)),
  };
});

/**
 * The paper of the caller's attempt: the questions of the sitting's exam in order, each with
 * its interactions and the response that the student saved. Only the bound device reads it,
 * and only while the attempt is open to it, so a locked, closing, or submitted attempt gets
 * `AttemptClosed`. The answer keys stay on the server, and no prompt is read here (ADR 0013).
 */
export const paper = Effect.fn("exams.sittings.paper")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const { attempt, sitting } = yield* boundAttempt(
    args.sittingId,
    args.deviceId
  );
  yield* requireOpen(attempt, yield* Clock.currentTimeMillis);
  const reader = yield* DatabaseReader;
  const saved = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", attempt._id)
    )
    .take(MAX_EXAM_QUESTIONS)
    .pipe(Effect.orDie);
  const responses: Responses = HashMap.fromIterable(
    Arr.map(saved, (answer) => Tuple.make(answer.question, answer.response))
  );
  const questions = yield* Effect.forEach(
    sitting.exam.questions,
    (questionId, index) => paperQuestion(questionId, index + 1, responses)
  );
  return { questions };
});
