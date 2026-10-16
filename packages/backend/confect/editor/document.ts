import {
  AssessmentDocumentSchema,
  MAX_DOCUMENT_DEPTH,
} from "@nakafa/aksara-contracts/assessment/document";
import {
  AttributesSchema,
  DocumentNodeSchema,
  fitsDocument,
} from "@repo/backend/confect/editor/node";
import {
  CONVEX_DOCUMENT_LIMIT,
  MAX_DOCUMENT_BYTES,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import { refusal } from "@repo/backend/confect/tenancy/errors";
import { getDocumentSize, type Value } from "convex/values";
import { Effect, Schema, SchemaTransformation } from "effect";

/**
 * The `doc` node at the root. It holds at least one node. The editor's document
 * node requires blocks there (`block+`, as `@tiptap/extension-document` writes
 * it), and the contract checks the node types at the snapshot (ADR 0028). This
 * schema does not name the node types.
 */
const DocumentRootSchema = Schema.Struct({
  attrs: Schema.optionalKey(AttributesSchema),
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

/**
 * A document's JSON text as the contract reads it: the assessment document of ADR
 * 0031. Its Schema checks the node types, the typed attributes, and the depth
 * before any node is read.
 */
const AssessmentTextSchema = Schema.fromJsonString(AssessmentDocumentSchema);

/**
 * A text that the contract refuses as a document, or that is not JSON. It names
 * no part of the text, so a learner's content never reaches an error message.
 */
export class DocumentInvalid extends Schema.TaggedError<DocumentInvalid>()(
  "DocumentInvalid",
  refusal("DOCUMENT_INVALID", "This is not a document the editor accepts.")
) {}

/** A stored row whose complete size would reach one document's limit. */
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
 * The text a document is stored as, from the text a client sent. The contract's
 * Schema reads the client's text first, so every stored document is one the
 * contract accepts (ADR 0028, ADR 0031). A text the contract refuses fails with
 * `DocumentInvalid`, and a stored text over the bound with `DocumentTooLarge`. A
 * typed document that the contract has just accepted cannot fail to encode, so
 * an encoding failure is a defect.
 */
export const storedDocument = Effect.fn("editor.document.stored")(function* (
  text: string
) {
  const document = yield* Schema.decodeEffect(AssessmentTextSchema)(text).pipe(
    Effect.mapError(() => new DocumentInvalid())
  );
  return yield* encodeDocument(document).pipe(
    Effect.catchTag("SchemaError", Effect.die)
  );
});

/**
 * Refuses a row whose complete size reaches one document's limit, as Convex's own
 * size function counts it: its system fields and every field, not only the text
 * (ADR 0028 Bounds, ADR 0031). A row under the limit is stored, and a row at the
 * limit or above it writes nothing.
 */
export const ensureRowSize = Effect.fn("editor.document.row")(function* (
  row: Record<string, Value>
) {
  const bytes = getDocumentSize(row);
  if (bytes >= CONVEX_DOCUMENT_LIMIT) {
    return yield* new DocumentTooLarge({
      bytes,
      limit: CONVEX_DOCUMENT_LIMIT,
    });
  }
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
