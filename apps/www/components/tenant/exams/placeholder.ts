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
