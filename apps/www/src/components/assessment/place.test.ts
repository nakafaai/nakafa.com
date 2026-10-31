import { describe, expect, it } from "@effect/vitest";
import { placeNodes } from "@/components/assessment/place";

describe("placeNodes", () => {
  it("keys each node of a level by its place, in reading order", () => {
    expect(placeNodes(["first", "second"])).toEqual([
      { key: "0", node: "first" },
      { key: "1", node: "second" },
    ]);
  });
});
