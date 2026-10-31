import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { ReadingSource } from "@repo/backend/confect/exams/question";
import { createEmptyDocument } from "@repo/backend/confect/exams/questions/place";
import { dropReading } from "@repo/backend/confect/exams/questions/remove";
import { Clock, Effect, Option } from "effect";

/** The document of a source, or none for no reading. A question of another exam is refused as a missing object. */
const readingOf = Effect.fn("exams.question.reading.source")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">,
  source: typeof ReadingSource.Type
) {
  if (source === "none") {
    return;
  }
  if (source === "new") {
    return yield* createEmptyDocument(exam);
  }
  const shared = yield* (yield* DatabaseReader)
    .table("examQuestions")
    .get(source)
    .pipe(Effect.option);
  if (Option.isNone(shared) || shared.value.examId !== exam._id) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
  return shared.value.reading;
});

/**
 * Gives one question a reading, or takes it away. Like its points, a reading leaves the revision. The reading the
 * question held goes when no other question holds it (`dropReading`).
 */
export const setReading = Effect.fn("exams.question.reading")(function* (
  exam: Pick<ExamsDoc, "_id" | "questions" | "scope" | "tenantId">,
  question: Pick<ExamQuestionsDoc, "_id" | "reading">,
  source: typeof ReadingSource.Type
) {
  const reading = yield* readingOf(exam, source);
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, { reading, updatedAt: at })
    .pipe(Effect.orDie);
  if (reading !== question.reading) {
    yield* dropReading(question.reading);
  }
});
