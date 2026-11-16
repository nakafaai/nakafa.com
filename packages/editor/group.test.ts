import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/editor/document";

/** A document schema with the two groups of blocks. */
const schema = documentSchema({
  headingLevels: [1],
  isLinkAllowed: () => true,
  marks: [],
});

describe("editor/group", () => {
  it("holds a stack and a block that group one block or more, written as divs", () => {
    const paragraph = schema.nodes.paragraph.create();
    for (const name of ["contentStack", "contentBlock"]) {
      const node = schema.nodes[name];
      const group = node?.create(null, [paragraph]);

      expect(node?.spec.content).toBe("block+");
      expect(node?.spec.parseDOM?.[0]?.tag).toBe(`div[data-type="${name}"]`);
      expect(group === undefined ? null : node?.spec.toDOM?.(group)).toEqual([
        "div",
        { "data-type": name },
        0,
      ]);
    }
  });
});
