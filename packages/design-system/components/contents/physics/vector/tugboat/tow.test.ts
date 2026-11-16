import { describe, expect, it } from "@effect/vitest";
import {
  TugsSchema,
  towResultant,
} from "@repo/design-system/components/contents/physics/vector/tugboat/tow";
import { Schema } from "effect";

const tugs = Schema.decodeSync(TugsSchema)({ first: 40, second: 30 });

describe("towResultant", () => {
  it("adds 40 kN and 30 kN at right angles into 50 kN, 36.87° from the first cable", () => {
    const resultant = towResultant(tugs, 90);
    expect(resultant.size).toBeCloseTo(50, 10);
    expect(resultant.fromFirst).toBeCloseTo(36.87, 2);
    expect(resultant.fromLine).toBeCloseTo(8.13, 2);
  });

  it("matches the cables' components at 60° between", () => {
    const resultant = towResultant(tugs, 60);
    expect(Math.hypot(resultant.ahead, resultant.port)).toBeCloseTo(
      resultant.size,
      10
    );
    expect(
      (Math.atan2(resultant.port, resultant.ahead) * 180) / Math.PI
    ).toBeCloseTo(resultant.fromLine, 10);
  });

  it("adds straight up to 70 kN with the cables together", () => {
    const resultant = towResultant(tugs, 0);
    expect(resultant.size).toBeCloseTo(70, 10);
    expect(resultant.fromFirst).toBeCloseTo(0, 10);
  });

  it("reads an obtuse angle from a weak first cable", () => {
    const weak = Schema.decodeSync(TugsSchema)({
      first: 10,
      second: 40,
    });
    const resultant = towResultant(weak, 140);
    expect(resultant.fromFirst).toBeGreaterThan(90);
    expect(Math.hypot(resultant.ahead, resultant.port)).toBeCloseTo(
      resultant.size,
      10
    );
    expect(
      (Math.atan2(resultant.port, resultant.ahead) * 180) / Math.PI
    ).toBeCloseTo(resultant.fromLine, 10);
  });
});
