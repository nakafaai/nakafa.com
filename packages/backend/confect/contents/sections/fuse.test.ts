import { describe, expect, it } from "@effect/vitest";
import { fuseRanks } from "@repo/backend/confect/contents/sections/fuse";

const identify = (item: string) => item;

describe("reciprocal rank fusion", () => {
  it("returns one list as it is", () => {
    expect(fuseRanks([["a", "b", "c"]], identify)).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for no lists", () => {
    expect(fuseRanks([], identify)).toEqual([]);
    expect(fuseRanks([[], []], identify)).toEqual([]);
  });

  it("puts the items that both lists hold before those held by one", () => {
    // c earns 1/63 + 1/61, b earns 1/62 + 1/62, a earns 1/61 and d earns 1/63.
    expect(
      fuseRanks(
        [
          ["a", "b", "c"],
          ["c", "b", "d"],
        ],
        identify
      )
    ).toEqual(["c", "b", "a", "d"]);
  });

  it("lets an item in the middle of both lists beat the leader of one list", () => {
    // With k = 60 a third place in two lists earns 2 / 63, more than the
    // 1 / 61 of a first place in one list.
    const semantic = ["x", "y", "shared"];
    const words = ["z", "w", "shared"];
    expect(fuseRanks([semantic, words], identify)[0]).toBe("shared");
  });

  it("keeps the order of first appearance among equal scores", () => {
    expect(fuseRanks([["a"], ["b"]], identify)).toEqual(["a", "b"]);
    expect(fuseRanks([["b"], ["a"]], identify)).toEqual(["b", "a"]);
  });

  it("counts an identity once per list, at its best rank", () => {
    // Without the rule a repeated "a" would add 1 / 62 and outrank "b".
    expect(fuseRanks([["a", "a", "b"], ["b"]], identify)).toEqual(["b", "a"]);
  });

  it("returns the first item seen for an identity", () => {
    const items = fuseRanks(
      [
        [{ id: "s", locale: "id" }],
        [
          { id: "s", locale: "en" },
          { id: "t", locale: "en" },
        ],
      ],
      ({ id }) => id
    );
    expect(items).toEqual([
      { id: "s", locale: "id" },
      { id: "t", locale: "en" },
    ]);
  });
});
