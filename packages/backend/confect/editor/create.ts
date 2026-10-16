import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { ensureRowSize } from "@repo/backend/confect/editor/document";
import { Clock, Effect } from "effect";

/**
 * Creates a document at head 0, with its snapshot at version 0 holding `text`, in the
 * caller's transaction. Every document is made here: a public create, the prompt of a
 * school exam question, and the prompt copied from another question. `text` is the
 * stored JSON text, which the caller has checked with `storedDocument`. A row over the
 * size bound fails before its write, so the transaction writes nothing.
 */
export const createDocument = Effect.fn("editor.document.create")(function* ({
  scope,
  tenantId,
  text,
}: {
  readonly scope: GrantScope;
  readonly tenantId: GenericId.GenericId<"tenants">;
  readonly text: string;
}) {
  const at = yield* Clock.currentTimeMillis;
  const writer = yield* DatabaseWriter;
  const documentId = yield* writer
    .table("editorDocuments")
    .insert({ createdAt: at, head: 0, scope, tenantId })
    .pipe(Effect.orDie);
  const snapshot = { at, content: text, documentId, version: 0 };
  yield* ensureRowSize(snapshot);
  yield* writer.table("editorSnapshots").insert(snapshot).pipe(Effect.orDie);
  return documentId;
});
