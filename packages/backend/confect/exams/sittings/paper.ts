import type {
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
import { Array as Arr, Effect, Option, Struct } from "effect";

/**
 * One question of the paper: its interactions decoded from the question row. The question's
 * answer key is never read, so it never reaches the paper. The prompt is read by `prompt`, one
 * question at a time, and what the student saved by `saved`, so the paper stays small and no
 * answer makes it read again.
 */
const paperQuestion = Effect.fn("exams.sittings.paper.question")(function* (
  questionId: ExamQuestionsDoc["_id"],
  number: number
) {
  const row = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  return {
    id: row._id,
    interactions: yield* questionAnswers(row.answers),
    number,
  };
});

/**
 * The caller's open attempt in a sitting, as the paper rule of the gate admits it: only the bound
 * device reads the paper and what it saved, and only while the attempt is open to it (ADR 0013).
 */
const admitted = Effect.fn("exams.sittings.paper.admitted")(function* (args: {
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
  return live;
});

/**
 * The paper of the caller's attempt: the questions of the sitting's exam in order, each with its
 * interactions. The answer keys stay on the server, and no prompt and no saved answer is read
 * here (ADR 0013).
 */
export const paper = Effect.fn("exams.sittings.paper")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const live = yield* admitted(args);
  const questions = yield* Effect.forEach(
    live.sitting.exam.questions,
    (questionId, index) => paperQuestion(questionId, index + 1)
  );
  return { questions };
});

/**
 * What the caller saved on the paper of its attempt: each answer with its version, and the
 * flagged questions. An answer or a flag reads this again; the paper, which reads every
 * question, does not change with them.
 */
export const saved = Effect.fn("exams.sittings.saved")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const live = yield* admitted(args);
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
  return {
    answers: Arr.map(answers, Struct.pick(["question", "response", "version"])),
    flagged: Arr.map(flags, (flag) => flag.question),
  };
});
