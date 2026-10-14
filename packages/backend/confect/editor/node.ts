import { Array as Arr, Predicate, Schema } from "effect";

/**
 * Deepest a document may nest. The `doc` node is level 1 and each node inside
 * it is one level deeper. A node's `content` array is not a level of its own.
 * ADR 0028 and ADR 0031 bound the node depth at 16. Convex allows 16 levels of
 * nested objects and arrays together (its limits page, read on 13 October 2026),
 * and every node is an object with a `content` array, so a node depth of 16 can
 * reach 32 Convex levels. That is why a document is stored as JSON text.
 */
export const MAX_DOCUMENT_DEPTH = 16;

/** A mark of a text node: its type, and attributes that are JSON values. */
export const MarkSchema = Schema.Struct({
  attrs: Schema.optionalKey(Schema.JsonObject),
  type: Schema.String,
});

/** The fields of a node as ProseMirror writes them in JSON. Its children are read by the same schema, one level down. */
const NodeFieldsSchema = Schema.Struct({
  attrs: Schema.optionalKey(Schema.JsonObject),
  content: Schema.optionalKey(
    Schema.Array(
      Schema.suspend((): Schema.Codec<DocumentNode> => DocumentNodeSchema)
    )
  ),
  marks: Schema.optionalKey(Schema.Array(MarkSchema)),
  text: Schema.optionalKey(Schema.String),
  type: Schema.String,
});

type NodeFields = typeof NodeFieldsSchema.Type;

/**
 * A node as ProseMirror writes it in JSON. A recursive Schema needs its type
 * named in its own definition (AGENTS.md). The interface only names the
 * recursive shape; every field is derived from `NodeFieldsSchema`.
 */
export interface DocumentNode extends NodeFields {}

/**
 * A node of a document. A text node holds non-empty text, because ProseMirror
 * refuses an empty text node and a text node with no text.
 *
 * Aksara's assessment document (`@nakafa/aksara-contracts` 0.49.0, export
 * `assessment/document`) types every block and holds stricter rules, such as
 * heading levels 1 to 3 and typed attributes. This package pins 0.48.9, which
 * has no assessment export, and the pin is not changed here, so this
 * declaration is the generic ProseMirror shape. When the pin moves, this file
 * imports the contract's node schema in place of the declaration, and the
 * snapshot writer checks each document with the contract's Schema (ADR 0028).
 */
export const DocumentNodeSchema: Schema.Codec<DocumentNode> =
  NodeFieldsSchema.check(
    Schema.makeFilter(
      (node: NodeFields) =>
        node.type !== "text" || (node.text !== undefined && node.text !== ""),
      { message: "Expected a text node with non-empty text." }
    )
  );

/**
 * Whether a value is one node of at most `levels` levels. It reads input that no
 * schema has checked yet, so it assumes no shape. It never calls itself more
 * than `levels` times in a row, whatever the input, so a deep input cannot
 * overflow the stack.
 */
function fitsNode(value: unknown, levels: number): boolean {
  return levels >= 1 && fitsContent(value, levels - 1);
}

/** Whether every node in the `content` of a value, if it has one, is at most `levels` levels deep. */
function fitsContent(value: unknown, levels: number): boolean {
  const content = Predicate.hasProperty(value, "content")
    ? value.content
    : undefined;
  return (
    !Arr.isArray(content) ||
    Arr.every(content, (child) => fitsNode(child, levels))
  );
}

/**
 * Whether a document, read as unchecked input, is at most `MAX_DOCUMENT_DEPTH`
 * levels deep. The document is one node, so it is checked as one node.
 */
export function fitsDocument(value: unknown): boolean {
  return fitsNode(value, MAX_DOCUMENT_DEPTH);
}

/**
 * Whether the content of a slice, read as unchecked input, is at most
 * `MAX_DOCUMENT_DEPTH` levels deep. This holds the slice's own nodes to the
 * bound. Where a slice lands in a document can add levels, so a document that
 * a step makes too deep is refused when it is snapshotted (ADR 0028), not here.
 */
export function fitsSlice(value: unknown): boolean {
  return fitsContent(value, MAX_DOCUMENT_DEPTH);
}
