import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import { createDocument } from "@repo/backend/confect/editor/create";
import { storedDocument } from "@repo/backend/confect/editor/document";
import type { QuestionTemplate } from "@repo/backend/confect/exams/question";
import {
  createEmptyDocument,
  placeQuestion,
} from "@repo/backend/confect/exams/questions/place";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

/** The exam a seeded question is placed in: its ID, its questions in order, its scope, and its school. */
export type SeededExam = Pick<
  ExamsDoc,
  "_id" | "questions" | "scope" | "tenantId"
>;

/**
 * Places one seeded question after `after`: the prompt document it is given, empty rubric and
 * explanation documents, and the answers, key, points and template that the question is written with, already
 * encoded as the question row stores them. It returns the question's ID.
 */
export const placeSeeded = Effect.fn("exams.seed.place")(function* (
  exam: SeededExam,
  after: ExamQuestionsDoc["_id"] | null,
  document: Parameters<typeof encodeJsonText>[0],
  written: {
    readonly answers: string;
    readonly key: string | null;
    readonly points: number;
    readonly template: QuestionTemplate;
  }
) {
  const prompt = yield* createDocument({
    scope: exam.scope,
    tenantId: exam.tenantId,
    text: yield* storedDocument(encodeJsonText(document)),
  });
  const rubric = yield* createEmptyDocument(exam);
  const explanation = yield* createEmptyDocument(exam);
  return yield* placeQuestion(exam, after, {
    ...written,
    explanation,
    prompt,
    rubric,
  });
}, Effect.orDie);
