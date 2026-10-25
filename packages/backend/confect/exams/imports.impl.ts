import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { figureImages } from "@repo/backend/confect/exams/figures";
import { requireUnfrozen } from "@repo/backend/confect/exams/freeze";
import { importedParts, keyOf } from "@repo/backend/confect/exams/import";
import spec from "@repo/backend/confect/exams/imports.spec";
import {
  encodeAnswers,
  encodeKey,
  NEW_QUESTION_POINTS,
  questionAnswers,
} from "@repo/backend/confect/exams/question";
import { answerQuestion } from "@repo/backend/confect/exams/questions/answer";
import {
  createEmptyDocument,
  placeQuestion,
} from "@repo/backend/confect/exams/questions/place";
import { questionOf } from "@repo/backend/confect/exams/questions/read";
import { removeQuestion } from "@repo/backend/confect/exams/questions/remove";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Layer, Option } from "effect";

/**
 * The exam's one question when it is the question the exam was created with and nobody has
 * touched it: its answers, key, and points never saved, and its prompt, rubric, and explanation
 * never edited.
 */
const untouchedOnly = (
  order: readonly GenericId.GenericId<"examQuestions">[]
) =>
  Effect.gen(function* () {
    const [only, ...rest] = order;
    if (only === undefined || Arr.isArrayNonEmpty(rest)) {
      return Option.none();
    }
    const reader = yield* DatabaseReader;
    const question = yield* reader
      .table("examQuestions")
      .get(only)
      .pipe(Effect.orDie);
    const documents = yield* Effect.forEach(
      [question.prompt, question.rubric, question.explanation],
      (id) => reader.table("editorDocuments").get(id).pipe(Effect.orDie)
    );
    const untouched =
      question.revision === 0 &&
      question.key === null &&
      question.points === NEW_QUESTION_POINTS &&
      Arr.every(documents, (document) => document.head === 0);
    return untouched ? Option.some(question) : Option.none();
  });

/** One document of an imported question, stored as a new document of the exam. */
const importedDocument = Effect.fn("exams.imports.document")(function* (
  exam: Pick<ExamsDoc, "scope" | "tenantId">,
  document: typeof ContentDocumentSchema.Type
) {
  const text = yield* storedDocument(encodeJsonText(document)).pipe(
    Effect.catchTag("DocumentInvalid", Effect.die)
  );
  return yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text,
  });
});

/**
 * Places the questions of one read at the end of the exam, in order, each with its figures as
 * images of the exam. A question that is not a choice of two to five options is left out and
 * counted. An exam that holds only the untouched question it was created with loses that
 * question once the first placed question is in, so an import into a new exam starts with the
 * file's first question. A frozen exam, or one the questions would take past its limit, writes
 * nothing.
 */
const place = FunctionImpl.make(
  databaseSchema,
  spec,
  "place",
  Effect.fn("exams.imports.place")(function* ({ questions }) {
    const exam = yield* Exam;
    yield* requireUnfrozen(exam);
    const parts = yield* Effect.map(
      Effect.forEach(questions, (question) =>
        Effect.map(figureImages(exam._id, question.figures), (figures) =>
          Option.map(importedParts(question, figures), (part) => ({
            number: question.number,
            part,
          }))
        )
      ),
      Arr.getSomes
    );
    const blank = yield* untouchedOnly(exam.questions);
    const kept = exam.questions.length - (Option.isSome(blank) ? 1 : 0);
    if (kept + parts.length > MAX_EXAM_QUESTIONS) {
      return yield* new ExamFull();
    }
    const placed = yield* Effect.forEach(parts, ({ number, part }) =>
      Effect.gen(function* () {
        return {
          fields: {
            answers: yield* encodeAnswers(part.answers),
            explanation: yield* importedDocument(exam, part.explanation),
            key: part.key === null ? null : yield* encodeKey(part.key),
            points: NEW_QUESTION_POINTS,
            prompt: yield* importedDocument(exam, part.prompt),
            rubric: yield* createEmptyDocument(exam),
          },
          keyed: part.key !== null,
          number,
        };
      })
    );
    const order = yield* Effect.reduce(
      placed,
      (): readonly GenericId.GenericId<"examQuestions">[] => exam.questions,
      (current, question) =>
        Effect.map(
          placeQuestion(
            {
              _id: exam._id,
              questions: current,
              scope: exam.scope,
              tenantId: exam.tenantId,
            },
            Option.getOrNull(Arr.last(current)),
            question.fields
          ).pipe(Effect.catchTag("AccessDenied", Effect.die)),
          (questionId) => Arr.append(current, questionId)
        )
    );
    if (Option.isSome(blank) && Arr.isArrayNonEmpty(placed)) {
      yield* removeQuestion(
        { _id: exam._id, questions: order },
        blank.value
      ).pipe(Effect.catchTag("ExamEmpty", Effect.die));
    }
    const ids = Arr.takeRight(order, placed.length);
    return {
      keyless: Arr.length(Arr.filter(placed, (question) => !question.keyed)),
      left: questions.length - parts.length,
      placed: Arr.zipWith(ids, placed, (id, question) => ({
        id,
        number: question.number,
      })),
    };
  })
);

/**
 * Gives each imported question the answer a later key table names. A question that already has
 * a key, or that the teacher has edited since it was placed, keeps what it has, and an answer
 * that names no option of the question is left out. A frozen exam writes nothing.
 */
const keys = FunctionImpl.make(
  databaseSchema,
  spec,
  "keys",
  Effect.fn("exams.imports.keys")(function* ({ keys: entries }) {
    const exam = yield* Exam;
    yield* requireUnfrozen(exam);
    const keyed = yield* Effect.forEach(entries, ({ answer, questionId }) =>
      Effect.gen(function* () {
        const question = yield* questionOf(exam, questionId);
        if (question.key !== null || question.revision !== 0) {
          return false;
        }
        const answers = yield* questionAnswers(question.answers);
        const key = Arr.findFirst(
          answers,
          (
            interaction
          ): interaction is Extract<Interaction, { kind: "choice" }> =>
            interaction.kind === "choice"
        ).pipe(
          Option.flatMap((choice) => Option.fromNullOr(keyOf(choice, answer)))
        );
        if (Option.isNone(key)) {
          return false;
        }
        yield* answerQuestion(question, {
          answers,
          key: key.value,
          revision: question.revision,
        }).pipe(
          Effect.catchTags({
            AnswersDoNotFit: Effect.die,
            DocumentTooLarge: Effect.die,
            KeyDoesNotFit: Effect.die,
            RevisionStale: Effect.die,
          })
        );
        return true;
      })
    );
    return { keyed: Arr.length(Arr.filter(keyed, Boolean)) };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(place),
  Layer.provide(keys),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
