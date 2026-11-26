import { describe, expect, it } from "@effect/vitest";
import { evaluateHalogenDisplacement } from "@repo/design-system/components/contents/chemistry/halogen/model";

describe("halogen displacement model", () => {
  it("displaces heavier halides down Group 17 and shows no reaction for I2 + KCl", () => {
    expect(evaluateHalogenDisplacement("cl2WithKbr").organicTone).toBe("amber");
    expect(evaluateHalogenDisplacement("cl2WithKi").organicTone).toBe("violet");
    expect(evaluateHalogenDisplacement("br2WithKi").displaced).toBe(true);
    expect(evaluateHalogenDisplacement("i2WithKcl").displaced).toBe(false);
  });
});
