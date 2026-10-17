import { describe, expect, it } from "@effect/vitest";
import { nodeDepth } from "@repo/utilities/depth";

/** A text leaf: a node with no children of its own. */
const text = { content: { content: [] } };

/** A paragraph that holds one text leaf. */
const paragraph = { content: { content: [text] } };

/** A document that holds one paragraph. */
const doc = { content: { content: [paragraph] } };

describe("nodeDepth", () => {
  it("counts a node and every level below it, text included", () => {
    expect(nodeDepth(text)).toBe(1);
    expect(nodeDepth(paragraph)).toBe(2);
    expect(nodeDepth(doc)).toBe(3);
  });

  it("counts the deepest branch, even when the first child is shallow", () => {
    expect(nodeDepth({ content: { content: [text, doc] } })).toBe(4);
  });
});
