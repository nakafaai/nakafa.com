import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { answerQuestion } from "@repo/backend/confect/exams/questions/answer";
import { copyQuestion } from "@repo/backend/confect/exams/questions/copy";
import { moveQuestion } from "@repo/backend/confect/exams/questions/move";
import { addQuestion } from "@repo/backend/confect/exams/questions/place";
import {
  questionOf,
  readQuestion,
} from "@repo/backend/confect/exams/questions/read";
import { removeQuestion } from "@repo/backend/confect/exams/questions/remove";
import spec from "@repo/backend/confect/exams/questions.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/** Adds a new question after one of the exam's questions, or last, and returns it. */
const add = FunctionImpl.make(
  databaseSchema,
  spec,
  "add",
  Effect.fn("exams.questions.add")(function* ({ after }) {
    const exam = yield* Exam;
    const questionId = yield* addQuestion(exam, after);
    return yield* readQuestion(questionId);
  })
);

/** Copies a question of the exam right after the original, and returns the copy. */
const copy = FunctionImpl.make(
  databaseSchema,
  spec,
  "copy",
  Effect.fn("exams.questions.copy")(function* ({ questionId }) {
    const exam = yield* Exam;
    const original = yield* questionOf(exam, questionId);
    const copied = yield* copyQuestion(exam, original);
    return yield* readQuestion(copied);
  })
);

/** Removes a question of the exam, unless it is the last one, and returns the order that is left. */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("exams.questions.remove")(function* ({ questionId }) {
    const exam = yield* Exam;
    const question = yield* questionOf(exam, questionId);
    return yield* removeQuestion(exam, question);
  })
);

/** Moves a question of the exam to an index of its order, and returns the order after the move. */
const move = FunctionImpl.make(
  databaseSchema,
  spec,
  "move",
  Effect.fn("exams.questions.move")(function* ({ index, questionId }) {
    const exam = yield* Exam;
    yield* questionOf(exam, questionId);
    return yield* moveQuestion(exam, questionId, index);
  })
);

/** Saves the answers and the key of a question at the revision the editor saw, and returns the question. */
const answer = FunctionImpl.make(
  databaseSchema,
  spec,
  "answer",
  Effect.fn("exams.questions.answer")(function* ({
    answers,
    key,
    questionId,
    revision,
  }) {
    const exam = yield* Exam;
    const question = yield* questionOf(exam, questionId);
    yield* answerQuestion(question, { answers, key, revision });
    return yield* readQuestion(questionId);
  })
);

/** Implements the questions group of `questions.spec.ts`: add, copy, remove, move, and answer. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(add),
  Layer.provide(copy),
  Layer.provide(remove),
  Layer.provide(move),
  Layer.provide(answer),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
