import type { OpenedDocument } from "@repo/backend/confect/editor/view";
import type { Schema as ProseSchema } from "@tiptap/pm/model";
import { Effect } from "effect";
import { readDocument, settleSteps } from "@/lib/editor/settle";

/**
 * A document as it stands now, from the reply that opens it: its snapshot with every
 * stored step after it applied, by the rule the server's fold and every editor use. A
 * reader that shows the document without editing it, such as a thumbnail, reads it this
 * way.
 */
export const foldedDocument = Effect.fn("editor.fold.document")(function* (
  schema: ProseSchema,
  opened: Pick<typeof OpenedDocument.Type, "snapshot" | "steps">
) {
  const snapshot = yield* readDocument(schema, opened.snapshot.content);
  const settled = yield* settleSteps(schema, snapshot, opened.steps);
  return settled.doc;
});
