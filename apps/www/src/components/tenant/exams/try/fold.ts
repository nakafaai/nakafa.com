import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { Effect, Option } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";
import { readDocument, settleSteps } from "@/lib/editor/settle";

/**
 * The prompt of a question as a student reads it: the snapshot that the editor opened, with the
 * steps after it applied by the rule that the server's fold uses (ADR 0028). The document is the
 * folded JSON value, which the reader takes as it is. A snapshot that the schema refuses fails with
 * `SyncFailed`.
 */
const foldPrompt = Effect.fn("exams.try.fold")(function* (
  opened: typeof OpenedDocument.Type
) {
  const document = yield* readDocument(
    assessmentSchema,
    opened.snapshot.content
  );
  const settled = yield* settleSteps(assessmentSchema, document, opened.steps);
  const folded: unknown = settled.doc.toJSON();
  return folded;
});

/**
 * The prompt of one question when it is ready to show, or none. A full page of steps may stop
 * short of the document's head, so the prompt waits rather than showing older text, as a student's
 * prompt waits for the fold (ADR 0028). A prompt that the schema refuses shows nothing.
 */
export const tryPrompt = Effect.fn("exams.try.prompt")(function* (
  opened: typeof OpenedDocument.Type
) {
  if (opened.steps.length >= STEP_PAGE_STEPS) {
    return Option.none();
  }
  return yield* foldPrompt(opened).pipe(
    Effect.asSome,
    Effect.catchTag("SyncFailed", () => Effect.succeedNone)
  );
});
