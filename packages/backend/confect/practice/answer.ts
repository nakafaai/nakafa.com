import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { verdictOf } from "@repo/backend/confect/assessment/verdict";
import {
  findPracticeSession,
  readPracticeAnswers,
  readPracticeQuestions,
  requirePracticeSession,
} from "@repo/backend/confect/practice/session";
import {
  PracticeError,
  type PracticeTarget,
} from "@repo/backend/confect/practice/sessions.spec";
import { gradeAnswer } from "@repo/backend/confect/tryouts/response/answer";
import { readExplanation } from "@repo/backend/confect/tryouts/rows";
import { readQuestionBody } from "@repo/backend/confect/tryouts/runtime/bodies";
import { isTryoutReviewPreviewQuestion } from "@repo/backend/confect/tryouts/runtime/content";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import { Array as Arr, Effect, HashMap, Option } from "effect";

/** A question of the caller's practice, with its session, refused as missing when either is not theirs. */
const requirePracticeQuestion = Effect.fn("practice.answer.question")(
  function* (userId: Id<"users">, questionId: Id<"practiceQuestions">) {
    const question = yield* (yield* DatabaseReader)
      .table("practiceQuestions")
      .get(questionId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (question === null) {
      return yield* new PracticeError({
        code: "PRACTICE_MISSING",
        message: "This practice question does not exist.",
      });
    }
    const session = yield* requirePracticeSession(
      userId,
      question.practiceSessionId
    );
    return { question, session };
  }
);

/** The answer a question was checked with, if it was. */
const findAnswer = Effect.fn("practice.answer.find")(function* (
  questionId: Id<"practiceQuestions">
) {
  return yield* (yield* DatabaseReader)
    .table("practiceAnswers")
    .get("by_practiceQuestionId", questionId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});

/**
 * Checks one question of the caller's practice: the frozen interaction, key and rule grade the response, as
 * a try-out's do (`gradeAnswer`), and the answer is kept, which makes the question final for its session.
 */
export const checkPracticeAnswer = Effect.fn("practice.answer.check")(
  function* (
    userId: Id<"users">,
    questionId: Id<"practiceQuestions">,
    response: ExamResponse,
    now: number
  ) {
    const { question, session } = yield* requirePracticeQuestion(
      userId,
      questionId
    );
    if (Option.isSome(yield* findAnswer(question._id))) {
      return yield* new PracticeError({
        code: "PRACTICE_CHECKED",
        message: "This question was already checked.",
      });
    }
    const graded = yield* Effect.fromResult(
      gradeAnswer(yield* readPlacedQuestion(question), response)
    );
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("practiceAnswers")
      .insert({
        checkedAt: now,
        grade: graded.grade,
        practiceQuestionId: question._id,
        practiceSessionId: session._id,
        response: graded.response,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("practiceSessions")
      .patch(session._id, { lastActivityAt: now })
      .pipe(Effect.orDie);
    return { verdict: verdictOf(graded.grade) };
  }
);

/** The caller's practice of one section as they work through it, or none before they open it. */
export const readPracticeState = Effect.fn("practice.answer.state")(function* (
  userId: Id<"users">,
  target: PracticeTarget
) {
  const found = yield* findPracticeSession(userId, target);
  if (Option.isNone(found)) {
    return null;
  }
  const session = found.value;
  const [questions, answers] = yield* Effect.all([
    readPracticeQuestions(session),
    readPracticeAnswers(session),
  ]);
  const byQuestion = HashMap.fromIterable(
    Arr.map(answers, (answer) => [answer.practiceQuestionId, answer] as const)
  );
  return {
    questions: Arr.map(questions, (question) => ({
      answer: Option.getOrNull(
        Option.map(
          HashMap.get(byQuestion, question._id),
          ({ checkedAt, grade, response }) => ({ checkedAt, grade, response })
        )
      ),
      questionId: question._id,
      questionOrder: question.questionOrder,
    })),
    sessionId: session._id,
  };
});

/** The bodies of the caller's session's questions, without their keys, which a page reads once. */
export const readPracticeContent = Effect.fn("practice.answer.content")(
  function* (
    userId: Id<"users">,
    sessionId: Id<"practiceSessions">,
    appLocale: AppLocaleCode
  ) {
    const session = yield* requirePracticeSession(userId, sessionId);
    const questions = yield* readPracticeQuestions(session);
    return yield* Effect.forEach(questions, (question) =>
      Effect.map(
        readQuestionBody({ appLocale, reviewed: false, row: question }),
        (body) => ({
          body,
          questionId: question._id,
          versionHash: question.versionHash,
        })
      )
    );
  }
);

/**
 * A checked question's key and explanation, for a reader who may read them: a Pro learner, or anyone on the
 * section's free samples (D2). A question that was not checked, or one the reader may not read, has none.
 */
export const readPracticeExplanation = Effect.fn("practice.answer.explain")(
  function* (
    userId: Id<"users">,
    questionId: Id<"practiceQuestions">,
    appLocale: AppLocaleCode
  ) {
    const { question } = yield* requirePracticeQuestion(userId, questionId);
    if (Option.isNone(yield* findAnswer(question._id))) {
      return null;
    }
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(Effect.orDie);
    if (
      user.plan !== "pro" &&
      !isTryoutReviewPreviewQuestion(question.questionOrder)
    ) {
      return null;
    }
    const [placed, explanation] = yield* Effect.all([
      readPlacedQuestion(question),
      readExplanation(question.versionHash, appLocale),
    ]);
    return {
      ...(Option.isSome(explanation) ? { explanation: explanation.value } : {}),
      key: placed.key,
    };
  }
);
