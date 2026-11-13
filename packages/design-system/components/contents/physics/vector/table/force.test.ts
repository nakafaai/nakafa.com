import { describe, expect, it } from "@effect/vitest";
import {
  PullsSchema,
  pullForce,
  tableResultant,
  twoPullResultant,
  wrapAngle,
} from "@repo/design-system/components/contents/physics/vector/table/force";
import { Schema } from "effect";

describe("pullForce", () => {
  it("pulls with the weight of 200 g, 1.96 N, along the pulley's angle", () => {
    const force = pullForce({ angle: 90, mass: 200 });
    expect(force.size).toBeCloseTo(1.96, 10);
    expect(force.x).toBeCloseTo(0, 10);
    expect(force.y).toBeCloseTo(1.96, 10);
  });
});

describe("wrapAngle", () => {
  it("brings any angle into one turn", () => {
    expect(wrapAngle(-90)).toBe(270);
    expect(wrapAngle(450)).toBe(90);
  });
});

describe("tableResultant", () => {
  it("adds 300 g at 0° and 400 g at 90° into 4.9 N at 53.13°", () => {
    const resultant = tableResultant([
      { angle: 0, mass: 300 },
      { angle: 90, mass: 400 },
    ]);
    expect(resultant.size).toBeCloseTo(4.9, 10);
    expect(resultant.angle).toBeCloseTo(53.13, 2);
  });

  it("is zero when a third string balances the first two", () => {
    const resultant = tableResultant([
      { angle: 0, mass: 300 },
      { angle: 90, mass: 400 },
      { angle: 233.130_102_354_155_98, mass: 500 },
    ]);
    expect(resultant.size).toBeCloseTo(0, 10);
    expect(resultant.angle).toBe(0);
  });

  it("points into the third quadrant when the pulls do", () => {
    const resultant = tableResultant([
      { angle: 180, mass: 100 },
      { angle: 270, mass: 100 },
    ]);
    expect(resultant.angle).toBeCloseTo(225, 10);
  });
});

describe("twoPullResultant", () => {
  it("agrees with the components for 200 g and 300 g at 60° apart", () => {
    const first = { angle: 20, mass: 200 };
    const second = { angle: 80, mass: 300 };
    const rule = twoPullResultant(first, second);
    const sum = tableResultant([first, second]);
    expect(rule.between).toBeCloseTo(60, 10);
    expect(rule.size).toBeCloseTo(sum.size, 10);
    expect(first.angle + rule.fromFirst).toBeCloseTo(sum.angle, 10);
  });

  it("measures the angle between across zero", () => {
    expect(
      twoPullResultant({ angle: 350, mass: 100 }, { angle: 20, mass: 100 })
        .between
    ).toBeCloseTo(30, 10);
  });

  it("gives an obtuse angle from the first pull when the second is much larger", () => {
    const first = { angle: 0, mass: 100 };
    const second = { angle: 150, mass: 400 };
    const rule = twoPullResultant(first, second);
    const sum = tableResultant([first, second]);
    expect(rule.fromFirst).toBeGreaterThan(90);
    expect(rule.fromFirst).toBeCloseTo(sum.angle, 10);
  });

  it("has no direction when equal pulls stand opposite", () => {
    const rule = twoPullResultant(
      { angle: 0, mass: 100 },
      { angle: 180, mass: 100 }
    );
    expect(rule.size).toBeCloseTo(0, 6);
    expect(rule.fromFirst).toBe(0);
  });
});

describe("PullsSchema", () => {
  it("needs at least two strings with positive masses", () => {
    const decode = Schema.decodeUnknownExit(PullsSchema);
    expect(decode([{ angle: 0, mass: 100 }])._tag).toBe("Failure");
    expect(
      decode([
        { angle: 0, mass: 100 },
        { angle: 90, mass: -1 },
      ])._tag
    ).toBe("Failure");
  });
});
