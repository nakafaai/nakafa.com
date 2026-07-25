// @vitest-environment node
import { resolveAuthoredLines } from "@repo/design-system/components/contents/mathematics/circle-lines";
import { describe, expect, it } from "vitest";

const rawLine = {
  color: "blue",
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ],
};

describe("authored circle lines", () => {
  it("preserves concrete line data and resolves every declarative primitive", () => {
    const lines = resolveAuthoredLines([
      rawLine,
      {
        color: "cyan",
        kind: "circle-outline",
        radius: 4,
        showPoints: false,
      },
      {
        color: "orange",
        kind: "circle-chord",
        radius: 4,
        startDegrees: 30,
        sweepDegrees: 120,
      },
      {
        color: "purple",
        degrees: 30,
        kind: "circle-radius",
        radius: 4,
      },
      {
        color: "amber",
        kind: "circle-arc",
        radius: 4,
        segments: 4,
        startDegrees: 30,
        sweepDegrees: 120,
      },
      {
        color: "lime",
        kind: "circle-segment",
        radius: 4,
        segments: 4,
        startDegrees: 30,
        sweepDegrees: 120,
      },
    ]);

    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe(rawLine);
    expect(lines[1]).toMatchObject({
      color: "cyan",
      showPoints: false,
    });
    expect(lines[1]?.points.length).toBeGreaterThan(4);
    expect(lines[2]?.points).toHaveLength(2);
    expect(lines[3]?.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(lines[4]).toMatchObject({
      color: "amber",
      showPoints: false,
      smooth: true,
    });
    expect(lines[5]).toMatchObject({ smooth: true });
    expect(lines[6]).toMatchObject({ smooth: false });
  });
});
