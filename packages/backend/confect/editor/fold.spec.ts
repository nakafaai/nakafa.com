import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import { Schema } from "effect";

/**
 * What one fold did: whether the log is level with the head, how many steps the fold
 * read, and how many of them the editors skip.
 */
const FoldResult = Schema.Struct({
  done: Schema.Boolean,
  folded: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  skipped: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The fold of one document's log into its snapshot (ADR 0028). It is internal: a submit
 * schedules it when the steps reach the limit, and the sweep schedules it for a document
 * whose steps the snapshot lacks. Each call folds one page of the log, and it starts the
 * next call while the log holds steps after the page. A refused snapshot writes nothing,
 * so its steps stay in the log.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "fold",
    args: () => ({ documentId: Id("editorDocuments") }),
    error: () => Schema.Union([DocumentInvalid, DocumentTooLarge]),
    returns: () => FoldResult,
  })
);
