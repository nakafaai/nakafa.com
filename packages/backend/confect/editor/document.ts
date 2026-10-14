import {
  DocumentNodeSchema,
  fitsDocument,
  MAX_DOCUMENT_DEPTH,
} from "@repo/backend/confect/editor/node";
import {
  MAX_DOCUMENT_BYTES,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import { Effect, Schema, SchemaTransformation } from "effect";

/**
 * The `doc` node at the root. It holds at least one node. The editor's document
 * node requires blocks there (`block+`, as `@tiptap/extension-document` writes
 * it), and the contract checks the node types at the snapshot (ADR 0028). This
 * schema does not name the node types.
 */
const DocumentRootSchema = Schema.Struct({
  attrs: Schema.optionalKey(Schema.JsonObject),
  content: Schema.NonEmptyArray(DocumentNodeSchema),
  type: Schema.Literal("doc"),
});

/**
 * A document as it arrives. Its depth is checked before any node is read, so a
 * document nested deeper than the bound fails as a schema issue and never as a
 * stack overflow. Encoding walks the typed nodes before it checks its output, so
 * `encodeDocument` runs this check on the typed input first.
 */
const UncheckedDocumentSchema = Schema.Unknown.check(
  Schema.makeFilter(fitsDocument, {
    message: `Expected a document at most ${MAX_DOCUMENT_DEPTH} levels deep.`,
  })
);

/** A document: ProseMirror JSON of at most `MAX_DOCUMENT_DEPTH` node levels. */
export const DocumentSchema = UncheckedDocumentSchema.pipe(
  Schema.decodeTo(
    DocumentRootSchema,
    SchemaTransformation.passthroughSupertype()
  )
);
export type Document = typeof DocumentSchema.Type;

/** The JSON text of a document: the one string field a document is stored in (ADR 0028). */
const DocumentTextSchema = Schema.fromJsonString(DocumentSchema);

/** A document whose stored JSON text is larger than one document may hold. */
export class DocumentTooLarge extends Schema.TaggedError<DocumentTooLarge>()(
  "DocumentTooLarge",
  {
    bytes: Schema.Int,
    limit: Schema.Int,
  }
) {}

/**
 * Writes a document as its JSON text. The depth of the typed input is checked
 * before the encoder walks it, so a deep document fails as a schema issue and
 * never as a stack overflow. A text over `MAX_DOCUMENT_BYTES` is refused here,
 * before any write, with the bytes it would take and the limit.
 */
export const encodeDocument = Effect.fn("editor.document.encode")(function* (
  document: Document
) {
  yield* Schema.decodeEffect(UncheckedDocumentSchema)(document);
  const text = yield* Schema.encodeEffect(DocumentTextSchema)(document);
  const bytes = utf8Bytes(text);
  if (bytes > MAX_DOCUMENT_BYTES) {
    return yield* new DocumentTooLarge({ bytes, limit: MAX_DOCUMENT_BYTES });
  }
  return text;
});

/**
 * Reads a stored document's JSON text back into a document. It checks the
 * ProseMirror shape and the depth. The contract's rules are checked at the
 * snapshot (ADR 0028), not here.
 */
export const decodeDocument = Effect.fn("editor.document.decode")(function* (
  text: string
) {
  return yield* Schema.decodeEffect(DocumentTextSchema)(text);
});
