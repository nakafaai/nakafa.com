import type { GenericId } from "@confect/core";
import editorInternal from "@repo/backend/confect/_generated/refs/editor.server";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { STEP_KEEP_DELAY } from "@repo/backend/confect/editor/prune";
import { Effect } from "effect";

/**
 * How long a document outlives the question or exam that held it (ADR 0028). Each editor and
 * drawing of a document reads it through a subscription, and a teacher's page lets that
 * subscription go only once it hears of the removal, a round trip later. A document deleted
 * before then would answer every read still open with a denial, and each one would fail in the
 * logs. A client offline for less than `STEP_KEEP_DELAY` still syncs from the log, so it also
 * hears of the removal before the document goes.
 */
export const DOCUMENT_GRACE = STEP_KEEP_DELAY;

/**
 * Schedules the deletion of a document whose owner is gone, after `DOCUMENT_GRACE`. The deletion
 * (`deletion.impl.ts`) then works through the document's rows in pages, each in a call of its own,
 * so the caller's transaction stays small whatever the document's history.
 */
export const dropDocument = Effect.fn("editor.deletion.drop")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  yield* (yield* Scheduler).runAfter(
    DOCUMENT_GRACE,
    editorInternal.deletion.document,
    { documentId }
  );
});
