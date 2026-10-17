import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** What one call of the deletion did: whether the document's rows are all gone, or a page of them is left for the next call. */
const DeletionResult = Schema.Struct({
  done: Schema.Boolean,
});

/**
 * The deletion of one collaborative document with the rows that belong to it. It is
 * the one owner of document deletion (ADR 0028), and it is internal: a public
 * function that deletes a document calls it. Each call deletes one page of the
 * document's session records and steps, and the call starts itself again until the
 * document's rows are gone.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "document",
    args: () => ({ documentId: Id("editorDocuments") }),
    returns: () => DeletionResult,
  })
);
