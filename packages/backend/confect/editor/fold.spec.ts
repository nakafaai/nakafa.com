import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import { Schema } from "effect";

/**
 * What one fold did: how many steps it folded, and how many of them the editors skip.
 */
const FoldResult = Schema.Struct({
  folded: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  skipped: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The fold of one document's log into its snapshot (ADR 0028). It is internal: a submit
 * schedules it when the steps reach a fold limit, and the sweep schedules it for a document
 * whose steps the snapshot lacks. One call folds every step the snapshot lacks, so the log
 * is level with the head when it returns. A refused snapshot writes nothing, so its steps
 * stay in the log.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "fold",
    args: () => ({ documentId: Id("editorDocuments") }),
    error: () => Schema.Union([DocumentInvalid, DocumentTooLarge]),
    returns: () => FoldResult,
  })
);
