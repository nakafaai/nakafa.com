import type { GenericId } from "@confect/core";
import type {
  EditorStepsDoc,
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  type DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { createDocument } from "@repo/backend/confect/editor/create";
import { snapshotOf, stepsAfter } from "@repo/backend/confect/editor/store";
import { QuestionHistoryLong } from "@repo/backend/confect/exams/errors";
import { placeQuestion } from "@repo/backend/confect/exams/questions/place";
import { Array as Arr, Effect } from "effect";

/** The parts of an exam that copying a question reads and writes. */
type ExamCopy = Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">;

/**
 * The steps of a document after one version, read in one call through the store. A
 * Convex function may call `paginate` once, so the copy takes the whole history in that
 * one read. A history that the read does not finish is refused, and writes nothing.
 */
const historyAfter = Effect.fn("exams.question.history")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number
): Effect.fn.Return<
  readonly EditorStepsDoc[],
  QuestionHistoryLong,
  DatabaseReader
> {
  const read = yield* stepsAfter(documentId, version);
  if (!read.done) {
    return yield* new QuestionHistoryLong();
  }
  return read.steps;
});

/**
 * Writes the steps of a copied prompt in version order, from version 1, and sets its
 * head to the number of steps. The author and the client of each step are kept, so a
 * copy shows who wrote each part of the text. A prompt without steps is left as it is.
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
 * Copies a question right after the original. Its prompt is a new document whose
 * snapshot is the original's snapshot, and whose steps are the original's steps after
 * that snapshot, renumbered from version 1. So the copy's text is the original's
 * current text, and the copy's log holds the same steps as the original's. The answers
 * and the key are copied as they are stored.
 */
export const copyQuestion = Effect.fn("exams.question.copy")(function* (
  exam: ExamCopy,
  original: ExamQuestionsDoc
) {
  const snapshot = yield* snapshotOf(original.prompt);
  const steps = yield* historyAfter(original.prompt, snapshot.version);
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: snapshot.content,
  });
  yield* copySteps(prompt, steps);
  return yield* placeQuestion(exam, original._id, {
    answers: original.answers,
    key: original.key,
    prompt,
  });
});
