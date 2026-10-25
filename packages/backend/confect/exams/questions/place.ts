import type { GenericId } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { insertIndex, placeAt } from "@repo/backend/confect/exams/order";
import {
  EMPTY_DOCUMENT_TEXT,
  encodeAnswers,
  NEW_QUESTION_POINTS,
  newChoiceAnswers,
  QuestionPoints,
} from "@repo/backend/confect/exams/question";
import { Clock, Effect, Option, Schema } from "effect";

/** The parts of an exam that placing a question reads and writes. */
type ExamPlace = Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">;

/** The fields of a question row that placing it writes, with the documents the question owns. */
const QuestionFields = Schema.Struct({
  answers: Schema.String,
  explanation: Id("editorDocuments"),
  key: Schema.NullOr(Schema.String),
  points: QuestionPoints,
  prompt: Id("editorDocuments"),
  rubric: Id("editorDocuments"),
});
type QuestionFields = typeof QuestionFields.Type;

/**
 * Places one question row in an exam, after `after` or last, with the given answers, key, points,
 * and documents, and patches the exam's order. A full exam is refused as `ExamFull`, and an `after`
 * that is not one of the exam's questions as a missing object. The refusals come before the exam's
 * order changes, and the transaction rolls back the rows already written. Returns the new question's ID.
 */
export const placeQuestion = Effect.fn("exams.question.place")(function* (
  exam: ExamPlace,
  after: GenericId.GenericId<"examQuestions"> | null,
  fields: QuestionFields
) {
  if (exam.questions.length >= MAX_EXAM_QUESTIONS) {
    return yield* new ExamFull();
  }
  const position = insertIndex(exam.questions, after);
  if (Option.isNone(position)) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
  const writer = yield* DatabaseWriter;
  const at = yield* Clock.currentTimeMillis;
  const questionId = yield* writer
    .table("examQuestions")
    .insert({
      answers: fields.answers,
      examId: exam._id,
      explanation: fields.explanation,
      key: fields.key,
      points: fields.points,
      prompt: fields.prompt,
      revision: 0,
      rubric: fields.rubric,
      template: "choice",
      tenantId: exam.tenantId,
      updatedAt: at,
    })
    .pipe(Effect.orDie);
  yield* writer
    .table("exams")
    .patch(exam._id, {
      questions: placeAt(exam.questions, questionId, position.value),
    })
    .pipe(Effect.orDie);
  return questionId;
});

/** Creates one empty document of an exam, which a question of the exam owns. */
export const createEmptyDocument = Effect.fn("exams.question.emptyDocument")(
  function* (exam: ExamPlace) {
    const text = yield* storedDocument(EMPTY_DOCUMENT_TEXT).pipe(Effect.orDie);
    return yield* createDocument({
      scope: exam.scope,
      tenantId: exam.tenantId,
      text,
    });
  }
);

/**
 * Adds a new question after `after`, or last: a single-answer choice with no correct option
 * marked, so its key is null, the default points, and one empty prompt, rubric, and explanation.
 */
export const addQuestion = Effect.fn("exams.question.add")(function* (
  exam: ExamPlace,
  after: GenericId.GenericId<"examQuestions"> | null
) {
  const prompt = yield* createEmptyDocument(exam);
  const rubric = yield* createEmptyDocument(exam);
  const explanation = yield* createEmptyDocument(exam);
  const answers = yield* encodeAnswers(newChoiceAnswers());
  return yield* placeQuestion(exam, after, {
    answers,
    explanation,
    key: null,
    points: NEW_QUESTION_POINTS,
    prompt,
    rubric,
  });
});
