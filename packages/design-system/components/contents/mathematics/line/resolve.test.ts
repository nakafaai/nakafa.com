// @vitest-environment node
import { resolveAuthoredLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { describe, expect, it } from "vitest";

const rawLine = {
  color: "blue",
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ],
};

describe("authored mathematical lines", () => {
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
      {
        center: { x: 2, y: 3, z: 4 },
        color: "slategray",
        height: 6,
        kind: "cuboid",
        length: 4,
        width: 8,
      },
    ]);

    expect(lines).toHaveLength(19);
    expect(lines[0]).toBe(rawLine);
    expect(lines[1]).toMatchObject({
      color: "cyan",
      showPoints: false,
      smooth: true,
    });
    expect(lines[1]?.points.length).toBeGreaterThan(4);
    expect(lines[2]).toMatchObject({ smooth: false });
    expect(lines[2]?.points).toHaveLength(2);
    expect(lines[3]).toMatchObject({ smooth: false });
    expect(lines[3]?.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(lines[4]).toMatchObject({
      color: "amber",
      showPoints: false,
      smooth: true,
    });
    expect(lines[5]).toMatchObject({ smooth: true });
    expect(lines[6]).toMatchObject({ smooth: false });
    expect(lines.slice(7)).toHaveLength(12);
    expect(lines.slice(7)).toSatisfy((cuboidLines: typeof lines) =>
      cuboidLines.every(
        (line) =>
          line.color === "slategray" &&
          line.points.length === 2 &&
          line.showPoints === false &&
          line.smooth === false
      )
    );
  });
});
