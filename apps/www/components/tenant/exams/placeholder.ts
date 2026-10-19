import { Id } from "@repo/backend/confect/_generated/id";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Schema } from "effect";

/**
 * The placeholder ID of an exam the server has not saved yet. The create mutation sends
 * only the title and the language, so the server never sees this ID, and the saved exam
 * replaces the placeholder in the list.
 */
export const placeholderExamId = randomUuid.pipe(
  Effect.flatMap((uuid) =>
    Schema.decodeUnknownEffect(Id("exams"))(uuid).pipe(Effect.orDie)
  )
);

/** The placeholder ID of a room the server has not scheduled yet. */
export const placeholderSittingId = randomUuid.pipe(
  Effect.flatMap((uuid) =>
    Schema.decodeUnknownEffect(Id("examSittings"))(uuid).pipe(Effect.orDie)
  )
);

/** The placeholder ID of a question the server has not saved yet. */
export const placeholderQuestionId = randomUuid.pipe(
  Effect.flatMap((uuid) =>
    Schema.decodeUnknownEffect(Id("examQuestions"))(uuid).pipe(Effect.orDie)
  )
);

/** The placeholder ID of the prompt of a question the server has not saved yet. */
export const placeholderPromptId = randomUuid.pipe(
  Effect.flatMap((uuid) =>
    Schema.decodeUnknownEffect(Id("editorDocuments"))(uuid).pipe(Effect.orDie)
  )
);

/**
 * Whether an ID is a placeholder this editor made: a UUID, which the server never issues,
 * since a Convex ID has no dashes. A question can still show its placeholder for a moment
 * after its save answered, until the exam's query brings the saved question, so a read
 * keyed by the question's prompt checks the ID itself.
 */
export const isPlaceholderId = Schema.is(Schema.String.check(Schema.isUUID()));
