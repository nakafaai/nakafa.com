import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import { Array as Arr, Effect, Option } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";
import { readDocument, settleSteps } from "@/lib/editor/settle";

/**
 * The version of a document's head: the version of its last step, or the snapshot's version when
 * no step follows the snapshot. Stored steps keep their order and never change, so one head
 * version names one state of the document. A reader keyed by it remounts for every change of the
 * document, and it may remount for a skipped step too, which changes nothing it shows.
 */
const headVersion = (opened: typeof OpenedDocument.Type) =>
  Option.match(Arr.last(opened.steps), {
    onNone: () => opened.snapshot.version,
    onSome: (step) => step.version,
  });

/**
 * The prompt of a question as a student reads it: the snapshot that the editor opened, with the
 * steps after it applied by the rule that the server's fold uses (ADR 0028). The document is the
 * folded JSON value, which the reader takes as it is, and `key` is its head version. A snapshot
 * that the schema refuses fails with `SyncFailed`.
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
  return { document: folded, key: headVersion(opened) };
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
