import { describe, expect, it } from "@effect/vitest";
import { documentSchema } from "@repo/editor/document";

/** A document schema with the block groups and math container. */
const schema = documentSchema({
  headingLevels: [1],
  isLinkAllowed: () => true,
  marks: [],
});

describe("editor/group", () => {
  it("holds contentStack, contentGrid, and contentBlock for one block or more, written as divs", () => {
    const paragraph = schema.nodes.paragraph.create();
    for (const name of ["contentStack", "contentGrid", "contentBlock"]) {
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

  it("holds mathContainer for one mathBlock or more, written as a div", () => {
    const mathBlock = schema.nodes.mathBlock.create({ latex: "x^2" });
    const node = schema.nodes.mathContainer;
    const group = node?.create(null, [mathBlock]);

    expect(node?.spec.content).toBe("mathBlock+");
    expect(node?.spec.parseDOM?.[0]?.tag).toBe(
      'div[data-type="mathContainer"]'
    );
    expect(group === undefined ? null : node?.spec.toDOM?.(group)).toEqual([
      "div",
      { "data-type": "mathContainer" },
      0,
    ]);
  });
});
