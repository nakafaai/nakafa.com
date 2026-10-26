import type {
  ExamAttemptsDoc,
  ExamQuestionsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { attemptIn } from "@repo/backend/confect/exams/sittings/attempt";
import { QuestionNotInExam } from "@repo/backend/confect/exams/sittings/errors";
import {
  sectionOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { currentPrompt } from "@repo/backend/confect/exams/sittings/prompt";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Option } from "effect";

/** The screen row of one attempt, the question its student's screen shows now, or none before the first. */
const screenOf = Effect.fn("exams.sittings.screen.row")(function* (
  attemptId: ExamAttemptsDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("examScreens")
    .index("by_attemptId", (query) => query.eq("attempt", attemptId))
    .first()
    .pipe(Effect.orDie);
});

/**
 * Records the question the caller's screen shows now (K25): the device that owns an open attempt names
 * the question the student moved to, and it replaces the attempt's screen row. The question must belong
 * to the sitting's exam, and the same question again writes nothing, so a screen costs a write only
 * when the student moves.
 */
export const look = Effect.fn("exams.sittings.screen.look")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  deviceId: string;
  questionId: ExamQuestionsDoc["_id"];
}) {
  const member = yield* Member;
  const { live, now } = yield* sittingGate
    .admit(
      rules.screen,
      member.person._id,
      Option.some(args.deviceId),
      sectionOf({
        attemptId: args.attemptId,
        person: member.person,
        tenantId: member.tenant._id,
      })
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  if (!Arr.contains(live.sitting.exam.questions, args.questionId)) {
    return yield* new QuestionNotInExam();
  }
  const writer = yield* DatabaseWriter;
  const stored = yield* screenOf(live.attempt._id);
  if (Option.isSome(stored)) {
    if (stored.value.question !== args.questionId) {
      yield* writer
        .table("examScreens")
        .patch(stored.value._id, { at: now, question: args.questionId })
        .pipe(Effect.orDie);
    }
    return null;
  }
  yield* writer
    .table("examScreens")
    .insert({
      at: now,
      attempt: live.attempt._id,
      question: args.questionId,
      tenantId: live.attempt.tenantId,
    })
    .pipe(Effect.orDie);
  return null;
});

/**
 * One student's screen as the proctor's panel draws it (K25): the question the student's screen shows
 * now, with its number, its prompt as the document stands, its interactions without any key, and the
 * response the student saved, and when the student moved there. It is null before the student opens a
 * question. The attempt must belong to the sitting the proctor may view. The panel draws the screen from
 * this data, never from a picture of it.
 */
export const screen = Effect.fn("exams.sittings.screen")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
}) {
  const sitting = yield* Sitting;
  const attempt = yield* attemptIn(sitting, args.attemptId, "sitting.view");
  const stored = yield* screenOf(attempt._id);
  if (Option.isNone(stored)) {
    return null;
  }
  const reader = yield* DatabaseReader;
  const question = yield* reader
    .table("examQuestions")
    .get(stored.value.question)
    .pipe(Effect.orDie);
  const answer = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", attempt._id).eq("question", question._id)
    )
    .first()
    .pipe(Effect.orDie);
  return {
    at: stored.value.at,
    interactions: yield* questionAnswers(question.answers),
    // The questions before it in the exam's order; a frozen exam keeps the question in that order.
    number:
      Arr.takeWhile(sitting.exam.questions, (id) => id !== question._id)
        .length + 1,
    prompt: yield* currentPrompt(question.prompt),
    response: Option.match(answer, {
      onNone: () => null,
      onSome: (saved) => saved.response,
    }),
  };
});
