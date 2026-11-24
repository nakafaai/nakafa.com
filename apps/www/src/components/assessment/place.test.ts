import { describe, expect, it } from "@effect/vitest";
import type { BlockNode } from "@nakafa/aksara-contracts/assessment/document";
import {
  groupConsecutiveMath,
  placeNodes,
} from "@/components/assessment/place";

const math = (latex: string): BlockNode => ({
  attrs: { latex },
  type: "mathBlock",
});

const para: BlockNode = {
  content: [{ text: "Halo", type: "text" }],
  type: "paragraph",
};

describe("placeNodes", () => {
  it("keys each node of a level by its place, in reading order", () => {
    expect(placeNodes(["first", "second"])).toEqual([
      { key: "0", node: "first" },
      { key: "1", node: "second" },
    ]);
  });
});

describe("groupConsecutiveMath", () => {
  it("wraps two or more consecutive bare mathBlock siblings into one mathContainer and leaves lone mathBlock bare", () => {
    const grouped = groupConsecutiveMath([
      para,
      math("a = 1"),
      math("b = 2"),
      para,
      math("c = 3"),
    ]);

    expect(grouped).toEqual([
      para,
      { content: [math("a = 1"), math("b = 2")], type: "mathContainer" },
      para,
      math("c = 3"),
    ]);
  });
});
