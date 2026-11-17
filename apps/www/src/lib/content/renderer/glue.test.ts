// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { splitTouching } from "@/lib/content/renderer/glue";

describe("the text that touches an inline formula", () => {
  it("takes the punctuation written against the formula and leaves the rest of the sentence", () => {
    expect(splitTouching(". Then it stops.")).toEqual({
      rest: " Then it stops.",
      touching: ".",
    });
    expect(splitTouching("), so")).toEqual({ rest: " so", touching: ")," });
    expect(splitTouching("-nya adalah")).toEqual({
      rest: " adalah",
      touching: "-nya",
    });
  });

  it("touches nothing when the text starts at a space a line may break at", () => {
    expect(splitTouching(" and then")).toEqual({
      rest: " and then",
      touching: "",
    });
    expect(splitTouching("\nand then")).toEqual({
      rest: "\nand then",
      touching: "",
    });
    expect(splitTouching("​and then")).toEqual({
      rest: "​and then",
      touching: "",
    });
  });

  it("keeps a unit after a no-break space with the formula", () => {
    expect(splitTouching(" kg. Then")).toEqual({
      rest: " Then",
      touching: " kg.",
    });
  });

  it("touches the whole text when it holds no space a line may break at", () => {
    expect(splitTouching(".")).toEqual({ rest: "", touching: "." });
  });
});
