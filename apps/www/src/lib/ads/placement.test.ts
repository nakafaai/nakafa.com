import { describe, expect, it } from "@effect/vitest";
import type { ContentTreeChild } from "@nakafa/aksara-contracts/tree";
import { Array as Arr } from "effect";
import { adSlotIndices } from "@/lib/ads/placement";

/** One block of a body's root, by its element name. */
function block(name: string): ContentTreeChild {
  return { $node: "element", children: [], name, props: {} };
}

/**
 * A body as its root holds it: an introduction, then each section as a heading
 * and a paragraph, with the line breaks the source keeps between blocks.
 */
function body(sections: number): readonly ContentTreeChild[] {
  return [
    block("p"),
    "\n",
    ...Arr.flatMap(Arr.range(1, sections), () => [
      block("h2"),
      "\n",
      block("p"),
      "\n",
    ]),
  ];
}

describe("where a body's ad frames stand", () => {
  it("holds no frame in a body of one section or none", () => {
    expect(adSlotIndices([])).toEqual([]);
    expect(adSlotIndices(body(1))).toEqual([]);
  });

  it("holds one frame before the last section of a body of two", () => {
    // Blocks: p, \n, h2, \n, p, \n, h2 (index 6).
    expect(adSlotIndices(body(2))).toEqual([6]);
  });

  it("holds one frame where both places meet in a body of three", () => {
    expect(adSlotIndices(body(3))).toEqual([10]);
  });

  it("holds a frame after the second section and one before the last", () => {
    expect(adSlotIndices(body(6))).toEqual([10, 22]);
  });

  it("reads only the second-level headings of the root", () => {
    const blocks = [
      block("h2"),
      block("h3"),
      block("h2"),
      "h2",
      block("p"),
      block("h2"),
    ];
    expect(adSlotIndices(blocks)).toEqual([5]);
  });
});
