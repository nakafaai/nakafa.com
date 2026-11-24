import { describe, expect, it } from "@effect/vitest";
import {
  clampStep,
  divisionState,
} from "@repo/design-system/components/contents/biology/gametogenesis/division";

describe("clampStep", () => {
  it("clamps meiosis step index into 0..3", () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(2.4)).toBe(2);
    expect(clampStep(9)).toBe(3);
  });
});

describe("divisionState", () => {
  it("halves diploid chromosomes after meiosis I and yields 4 sperm vs 1 ovum + 3 polar bodies", () => {
    expect(divisionState("male", "system", 0, 46)).toEqual({
      cellKey: "spermatogonium",
      chromosomeCount: 46,
      madeCount: 4,
      polarCount: 0,
    });
    expect(divisionState("female", "gonad", 0, 46).cellKey).toBe("oogonium");
    expect(divisionState("male", "meiosis", 0, 46).cellKey).toBe(
      "spermatogonium"
    );
    expect(divisionState("male", "meiosis", 1, 46).chromosomeCount).toBe(46);
    expect(divisionState("male", "meiosis", 2, 46)).toEqual({
      cellKey: "secondarySpermatocyte",
      chromosomeCount: 23,
      madeCount: 4,
      polarCount: 0,
    });
    expect(divisionState("male", "meiosis", 3, 46).cellKey).toBe("spermatid");
    expect(divisionState("female", "meiosis", 0, 46).cellKey).toBe("oogonium");
    expect(divisionState("female", "meiosis", 1, 46).cellKey).toBe(
      "primaryOocyte"
    );
    expect(divisionState("female", "meiosis", 2, 46)).toEqual({
      cellKey: "secondaryOocyte",
      chromosomeCount: 23,
      madeCount: 1,
      polarCount: 3,
    });
    expect(divisionState("female", "meiosis", 3, 46).cellKey).toBe("ovum");
    expect(divisionState("male", "gamete", 0, 46).cellKey).toBe("sperm");
    expect(divisionState("female", "gamete", 0, 46)).toEqual({
      cellKey: "ovum",
      chromosomeCount: 23,
      madeCount: 1,
      polarCount: 3,
    });
  });
});
