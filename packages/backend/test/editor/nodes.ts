import type { Document } from "@repo/backend/confect/editor/document";
import type { DocumentNode } from "@repo/backend/confect/editor/node";
import type { Schema } from "effect";

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

/**
 * A document whose deepest node is `levels` node levels down, counting the `doc` node as
 * level 1. Its leaf is text, which a paragraph holds, and the blockquotes above the paragraph
 * are blocks, so the contract reads the whole chain as a document (ADR 0031).
 */
export function documentOf(levels: number): Document {
  let node: DocumentNode = {
    content: [{ text: "x", type: "text" }],
    type: "paragraph",
  };
  for (let level = 3; level < levels; level += 1) {
    node = { content: [node], type: "blockquote" };
  }
  return { content: [node], type: "doc" };
}

/**
 * A chain of `levels` JSON objects, each holding the one below it, with an empty
 * object at the bottom. It is built in a loop, so a chain of 100,000 levels is
 * built without overflowing the stack that the code under test must survive.
 */
export function nestedAttrs(levels: number): Schema.JsonObject {
  let attrs: Schema.JsonObject = {};
  for (let level = 1; level < levels; level += 1) {
    attrs = { a: attrs };
  }
  return attrs;
}

/**
 * A chain of `levels` JSON arrays, each holding the one below it, with an empty
 * array at the bottom. It is built in a loop, as `nestedAttrs` is.
 */
export function nestedArray(levels: number): Schema.Json {
  let value: Schema.Json = [];
  for (let level = 1; level < levels; level += 1) {
    value = [value];
  }
  return value;
}

/** A document of one paragraph that holds `text`. */
export function paragraphOf(text: string): Document {
  return {
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  };
}

/**
 * `count` blockquotes nested around `inner`, each one a level of the document. It is built
 * in a loop, as the chains above are.
 */
export function nestBlockquotes(
  count: number,
  inner: DocumentNode
): DocumentNode {
  let node = inner;
  for (let level = 0; level < count; level += 1) {
    node = { content: [node], type: "blockquote" };
  }
  return node;
}
