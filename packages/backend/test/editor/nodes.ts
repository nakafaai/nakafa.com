import type { Document } from "@repo/backend/confect/editor/document";
import type { DocumentNode } from "@repo/backend/confect/editor/node";

/**
 * A chain of `levels` nodes, each holding the one below it, with a text leaf at
 * the bottom. It is built in a loop, so a chain of 100,000 levels is built
 * without overflowing the stack that the code under test must survive.
 */
export function nested(levels: number): DocumentNode {
  let node: DocumentNode = { text: "x", type: "text" };
  for (let level = 1; level < levels; level += 1) {
    node = { content: [node], type: "blockquote" };
  }
  return node;
}

/** A document whose deepest node is `levels` node levels down, counting the `doc` node as level 1. */
export function documentOf(levels: number): Document {
  return { content: [nested(levels - 1)], type: "doc" };
}

/** A document of one paragraph that holds `text`. */
export function paragraphOf(text: string): Document {
  return {
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  };
}
