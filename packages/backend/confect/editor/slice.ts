import { BlockSchema } from "@nakafa/aksara-contracts/assessment/document";
import { InlineNodeSchema } from "@nakafa/aksara-contracts/assessment/inline";
import type { DocumentNode } from "@repo/backend/confect/editor/node";
import type { Step } from "@repo/backend/confect/editor/step";
import { Array as Arr, Effect, Schema } from "effect";

/**
 * A node of a slice, read as the contract reads the same node in a document: a block,
 * or an inline node such as a text run or a line break. The text marks of a text node
 * are read with it, by the contract's own mark schema.
 */
const SliceNodeSchema = Schema.Union([BlockSchema, InlineNodeSchema]);

/**
 * A node as the contract reads it. A list item belongs to its list, so the contract
 * reads it inside a list of one item. Any other node is read as it is.
 */
const readableNode = (node: DocumentNode): unknown =>
  node.type === "listItem" ? { content: [node], type: "bulletList" } : node;

/** Checks each node of a slice, with the contract's schema for its kind. */
const checkNodes = (nodes: readonly DocumentNode[]) =>
  Effect.forEach(
    nodes,
    (node) => Schema.decodeUnknownEffect(SliceNodeSchema)(readableNode(node)),
    { discard: true }
  );

/** The slice that a replace step carries. A step that only removes content holds none. */
type StepSlice = NonNullable<
  Extract<Step, { readonly stepType: "replace" }>["slice"]
>;

/** A paragraph: the block that a list item opens with, and that a quote may hold. */
const PARAGRAPH: DocumentNode = { type: "paragraph" };

/** A list item that holds a paragraph: the one item that a list may hold. */
const LIST_ITEM: DocumentNode = { content: [PARAGRAPH], type: "listItem" };

/**
 * The content that the contract requires of an empty container: a list holds an item,
 * an item opens with a paragraph, and a quote holds a block. A container of any other
 * type is read as it is, because the contract allows it to be empty.
 */
const REQUIRED_CONTENT: Partial<
  Record<DocumentNode["type"], readonly DocumentNode[]>
> = {
  blockquote: [PARAGRAPH],
  bulletList: [LIST_ITEM],
  listItem: [PARAGRAPH],
  orderedList: [LIST_ITEM],
};

/**
 * Gives an empty container the content that the contract requires of it. A node that
 * holds content, or whose type requires none, is returned as it is.
 */
const fillEmpty = (node: DocumentNode): DocumentNode => {
  const required = REQUIRED_CONTENT[node.type];
  if (required === undefined || (node.content ?? []).length > 0) {
    return node;
  }
  return { ...node, content: required };
};

/**
 * Fills the innermost node of a chain of `depth` levels. The chain follows the first
 * child of each node, or the last child when `side` is `"last"`, and depth 1 is the node
 * itself. Each node above the innermost one holds the chain, so only the innermost one
 * can be empty. A node with no child where the chain goes on is read as it is.
 */
const fillChain = (
  node: DocumentNode,
  depth: number,
  side: "first" | "last"
): DocumentNode => {
  if (depth <= 1) {
    return fillEmpty(node);
  }
  const content = node.content ?? [];
  if (content.length === 0) {
    return node;
  }
  const index = side === "first" ? 0 : content.length - 1;
  return {
    ...node,
    content: Arr.map(content, (child, position) =>
      position === index ? fillChain(child, depth - 1, side) : child
    ),
  };
};

/**
 * The nodes of a slice, with the containers filled that the step does not write. An open
 * edge runs `openStart` levels down the first node and `openEnd` levels down the last
 * one, and the content past that edge is in the document. The gap of a replace-around
 * step runs `gapDepth` levels down the first node, and the step keeps the gap's content
 * without writing it. So the innermost container there is empty in the slice only because
 * its content is elsewhere. The contract reads it with the content it requires, and the
 * snapshot reads the content that the document keeps (ADR 0028).
 */
const fillOutside = (
  slice: StepSlice,
  gapDepth: number
): readonly DocumentNode[] => {
  const { content, openEnd = 0, openStart = 0 } = slice;
  const startDepth = Math.max(openStart, gapDepth);
  const lastPosition = content.length - 1;
  return Arr.map(content, (node, position) => {
    const started =
      position === 0 && startDepth > 0
        ? fillChain(node, startDepth, "first")
        : node;
    return position === lastPosition && openEnd > 0
      ? fillChain(started, openEnd, "last")
      : started;
  });
};

/**
 * Checks the slice of a step, when it holds one. The containers that the step leaves
 * open, or keeps as a gap, are filled first, so each node is read as a whole node.
 */
export const checkSlice = (slice: StepSlice | undefined, gapDepth: number) =>
  slice === undefined ? Effect.void : checkNodes(fillOutside(slice, gapDepth));
