import { describe, expect, it } from "@effect/vitest";
import {
  fuseRanks,
  placeOf,
} from "@repo/backend/confect/contents/sections/fuse";

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

  it("ranks identities, so that a repeated identity does not push the ones after it down", () => {
    // The first letter is the identity: X1 and X2 are one place in two
    // languages. Y1 is the second place of its list, and earns 1 / 62 as Q1
    // does, so Q1 does not outrank it. Counted by position, Y1 would earn
    // 1 / 63 and fall behind Q1.
    const byPlace = (item: string) => item.slice(0, 1);
    expect(
      fuseRanks(
        [
          ["X1", "X2", "Y1"],
          ["P1", "Q1"],
        ],
        byPlace
      )
    ).toEqual(["X1", "P1", "Y1", "Q1"]);
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

describe("place of a section", () => {
  it("names the place by document and ordinal, whatever the language", () => {
    expect(placeOf({ contentKey: "material/lesson/a", ordinal: 2 })).toBe(
      "material/lesson/a#2"
    );
    expect(placeOf({ contentKey: "material/lesson/a", ordinal: 3 })).not.toBe(
      placeOf({ contentKey: "material/lesson/a", ordinal: 2 })
    );
  });
});
