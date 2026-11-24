import { describe, expect, it } from "@effect/vitest";
import {
  cellOutline,
  drawingScale,
  formatMagnification,
  leaderLines,
  magnificationOf,
  strokeProgress,
} from "@repo/design-system/components/contents/biology/drawing/scale";

describe("magnificationOf", () => {
  it("computes drawing length in mm over actual specimen length in um", () => {
    expect(magnificationOf(40, 100)).toBe(400);
    expect(magnificationOf(60, 250)).toBe(240);
  });
});

describe("formatMagnification", () => {
  it("formats whole and fractional magnifications cleanly", () => {
    expect(formatMagnification(400)).toBe("×400");
    expect(formatMagnification(125.46)).toBe("×125.5");
  });
});

describe("drawingScale", () => {
  it("maps slider endpoints and clamps out-of-range values", () => {
    expect(drawingScale(20, 20, 100)).toBeCloseTo(0.68, 5);
    expect(drawingScale(100, 20, 100)).toBeCloseTo(1.2, 5);
    expect(drawingScale(5, 20, 100)).toBeCloseTo(0.68, 5);
    expect(drawingScale(50, 50, 50)).toBeCloseTo(0.68, 5);
  });
});

describe("strokeProgress", () => {
  it("ramps linearly from 0 to 1 and holds at 1 before looping", () => {
    expect(strokeProgress(0)).toBe(0);
    expect(strokeProgress(1.8)).toBeCloseTo(0.5, 5);
    expect(strokeProgress(4.2)).toBe(1);
  });
});

describe("cellOutline", () => {
  it("produces closed outlines for both onion and cheek cells with optional jitter", () => {
    const onion = cellOutline("onion", 1);
    expect(onion).toHaveLength(5);
    expect(onion[0]).toEqual(onion[4]);

    const onionJitter = cellOutline("onion", 1, 0.01);
    expect(onionJitter[0]?.[0]).not.toBe(onion[0]?.[0]);

    const cheek = cellOutline("cheek", 1);
    expect(cheek).toHaveLength(21);
    const cheekJitter = cellOutline("cheek", 1, 0.01);
    expect(cheekJitter[1]?.[0]).not.toBe(cheek[1]?.[0]);
  });
});

describe("leaderLines", () => {
  it("uses horizontal parallel lines when correct and crossed diagonal lines when faulty", () => {
    const clean = leaderLines(1, false);
    expect(clean).toHaveLength(3);
    for (const line of clean) {
      expect(line.start[2]).toBe(line.end[2]);
    }

    const faulty = leaderLines(1, true);
    expect(faulty).toHaveLength(3);
    expect(faulty[0]?.start[2]).not.toBe(faulty[0]?.end[2]);
  });
});
