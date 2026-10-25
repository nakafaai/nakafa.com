import type {
  ExamAnswersDoc,
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  heldSection,
  sectionOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, HashMap, Option, Tuple } from "effect";

/** The saved answers of an attempt, by the question each one answers. */
type Saved = HashMap.HashMap<ExamQuestionsDoc["_id"], ExamAnswersDoc>;

/**
 * One question of the paper: its interactions decoded from the question row, the response
 * and version that the student saved, and whether the student flagged it. The question's
 * answer key is never read, so it never reaches the paper. The prompt is read by `prompt`,
 * one question at a time, so the paper stays small.
 */
const paperQuestion = Effect.fn("exams.sittings.paper.question")(function* (
  questionId: ExamQuestionsDoc["_id"],
  number: number,
  saved: Saved,
  flagged: readonly string[]
) {
  const row = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const interactions = yield* questionAnswers(row.answers);
  const answer = HashMap.get(saved, questionId);
  return {
    flagged: Arr.contains(flagged, questionId),
    id: row._id,
    interactions,
    number,
    response: Option.match(answer, {
      onNone: () => null,
      onSome: (saved) => saved.response,
    }),
    version: Option.match(answer, {
      onNone: () => null,
      onSome: (saved) => saved.version,
    }),
  };
});

/**
 * The paper of the caller's attempt: the questions of the sitting's exam in order, each with
 * its interactions, the response that the student saved with its version, and whether it is
 * flagged. Only the bound device reads it, and only while the attempt is open to it, which
 * the gate decides for the paper rule. The answer keys stay on the server, and no prompt is
 * read here (ADR 0013).
 */
export const paper = Effect.fn("exams.sittings.paper")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const section = yield* heldSection(args.sittingId, member);
  const { live } = yield* sittingGate
    .admit(
      rules.paper,
      member.person._id,
      Option.some(args.deviceId),
      sectionOf(section)
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  const reader = yield* DatabaseReader;
  const answers = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", live.attempt._id)
    )
    .take(MAX_EXAM_QUESTIONS)
    .pipe(Effect.orDie);
  const flags = yield* reader
    .table("assessmentFlags")
    .index("by_attempt_and_question", (query) =>
      query.eq("attempt", live.attempt._id)
    )
    .take(MAX_EXAM_QUESTIONS)
    .pipe(Effect.orDie);
  const saved: Saved = HashMap.fromIterable(
    Arr.map(answers, (answer) => Tuple.make(answer.question, answer))
  );
  const flagged = Arr.map(flags, (flag) => flag.question);
  const questions = yield* Effect.forEach(
    live.sitting.exam.questions,
    (questionId, index) => paperQuestion(questionId, index + 1, saved, flagged)
  );
  return { questions };
});
