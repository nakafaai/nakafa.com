import type { GenericId } from "@confect/core";
import type {
  EditorStepsDoc,
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { createDocument } from "@repo/backend/confect/editor/create";
import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import { snapshotOf, stepsThrough } from "@repo/backend/confect/editor/store";
import { QuestionHistoryLong } from "@repo/backend/confect/exams/errors";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { Array as Arr, Effect } from "effect";

/** The parts of an exam that copying a question reads and writes. */
type ExamCopy = Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">;

/**
 * The version of a document, the number of steps it has accepted. It is read from the
 * document's small row, so the copy knows how many steps follow its snapshot.
 */
const headOf = Effect.fn("exams.question.head")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  const document = yield* (yield* DatabaseReader)
    .table("editorDocuments")
    .get(documentId)
    .pipe(Effect.orDie);
  return document.head;
});

/**
 * The steps of a document after one version, up to its head, through the store. A
 * history longer than one page of steps (`STEP_PAGE_STEPS`, the bound of `since`) is
 * refused before any step is read, so the copy reads no more than one page and writes
 * nothing.
 */
const historyAfter = Effect.fn("exams.question.history")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number,
  head: number
): Effect.fn.Return<
  readonly EditorStepsDoc[],
  QuestionHistoryLong,
  DatabaseReader
> {
  if (head - version > STEP_PAGE_STEPS) {
    return yield* new QuestionHistoryLong();
  }
  return yield* stepsThrough(documentId, version, head);
});

/**
 * Writes the steps of a copied document in version order, from version 1, and sets its
 * head to the number of steps. The author and the client of each step are kept, so a
 * copy shows who wrote each part of the text. A document without steps is left as it is.
 */
const copySteps = Effect.fn("exams.question.copySteps")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  steps: readonly EditorStepsDoc[]
) {
  if (Arr.isReadonlyArrayEmpty(steps)) {
    return;
  }
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    steps,
    (step, index) =>
      writer
        .table("editorSteps")
        .insert({
          author: step.author,
          clientId: step.clientId,
          documentId,
          step: step.step,
          version: index + 1,
        })
        .pipe(Effect.orDie),
    { discard: true }
  );
  yield* writer
    .table("editorDocuments")
    .patch(documentId, { head: steps.length })
    .pipe(Effect.orDie);
});

/**
 * Copies one document a question owns. The copy is a new document whose snapshot is the
 * original's snapshot, and whose steps are the original's steps after that snapshot,
 * renumbered from version 1. So the copy's text is the original's current text, and the
 * copy's log holds the same steps as the original's.
 */
const copyDocument = Effect.fn("exams.question.copyDocument")(function* (
  exam: ExamCopy,
  documentId: GenericId.GenericId<"editorDocuments">
) {
  const snapshot = yield* snapshotOf(documentId);
  const head = yield* headOf(documentId);
  const steps = yield* historyAfter(documentId, snapshot.version, head);
  const copied = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: snapshot.content,
  });
  yield* copySteps(copied, steps);
  return copied;
});

/**
 * Copies a question right after the original. Its prompt, rubric, and explanation are new
 * documents, each copied with its history (see `copyDocument`). The answers, the key, the
 * points, and the template are copied as they are stored.
 */
export const copyQuestion = Effect.fn("exams.question.copy")(function* (
  exam: ExamCopy,
  original: ExamQuestionsDoc
) {
  const prompt = yield* copyDocument(exam, original.prompt);
  const rubric = yield* copyDocument(exam, original.rubric);
  const explanation = yield* copyDocument(exam, original.explanation);
  return yield* placeQuestion(exam, original._id, {
    answers: original.answers,
    explanation,
    key: original.key,
    points: original.points,
    prompt,
    rubric,
    template: original.template,
  });
});
