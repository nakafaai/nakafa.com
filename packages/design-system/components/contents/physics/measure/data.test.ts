import { describe, expect, it } from "@effect/vitest";
import {
  motionAreas,
  pendulumLine,
  readingStats,
} from "@repo/design-system/components/contents/physics/measure/data";

describe("readingStats", () => {
  it("finds Q's readings precise but 0.12 cm too large", () => {
    const q = readingStats([2.62, 2.62, 2.61, 2.63], 2.5);
    expect(q.mean).toBeCloseTo(2.62, 9);
    expect(q.offset).toBeCloseTo(0.12, 9);
    expect(q.range).toBeCloseTo(0.02, 9);
  });
});

describe("pendulumLine", () => {
  it("gives g of about 9.87 from a gradient of 4.0 and cuts the axes at 0.040 s2 and -0.010 m", () => {
    const line = pendulumLine(4, 0.01);
    expect(line.gravity).toBeCloseTo(9.87, 2);
    expect(line.periodIntercept).toBeCloseTo(0.04, 9);
    expect(line.lengthIntercept).toBe(-0.01);
  });
});

describe("motionAreas", () => {
  it("adds 24, 72 and 18 m forward and takes 6 m back, a displacement of 108 m over 120 m", () => {
    const motion = motionAreas(0, [
      { duration: 4, end: 12 },
      { duration: 6, end: 12 },
      { duration: 3, end: 0 },
      { duration: 2, end: -6 },
    ]);
    expect(motion.areas).toEqual([24, 72, 18, -6]);
    expect(motion.displacement).toBe(108);
    expect(motion.distance).toBe(120);
  });

  it("splits a stretch that crosses the axis into parts that partly cancel", () => {
    expect(motionAreas(4, [{ duration: 2, end: -4 }]).displacement).toBeCloseTo(
      0,
      9
    );
  });
});
