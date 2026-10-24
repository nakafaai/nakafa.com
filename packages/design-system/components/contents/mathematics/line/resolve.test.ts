// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  resolveAuthoredLines,
  resolveLineScene,
  summarizeLines,
} from "@repo/design-system/components/contents/mathematics/line/resolve";
import { Array as Arr, Option } from "effect";

const rawLine = {
  color: "blue",
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ],
};

describe("authored mathematical lines", () => {
  it("resolves a curve into one smooth-free line per branch, labelling the middle one", () => {
    const lines = resolveAuthoredLines([
      {
        color: "green",
        curve: {
          amplitude: 1,
          domain: [-Math.PI, Math.PI],
          frequency: 1,
          kind: "tan",
          phase: 0,
          shift: 0,
        },
        labels: [{ text: "tan" }],
        showPoints: false,
      },
    ]);

    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.color)).toEqual([
      "green",
      "green",
      "green",
    ]);
    expect(lines.map((line) => line.smooth)).toEqual([false, false, false]);
    expect(lines.map((line) => line.labels)).toEqual([
      undefined,
      [{ text: "tan" }],
      undefined,
    ]);
    expect(lines.every((line) => line.points.length >= 200)).toBe(true);
  });

  it("resolves a sine curve into one line that keeps its style", () => {
    const [line, ...rest] = resolveAuthoredLines([
      {
        color: "teal",
        curve: {
          amplitude: 2,
          domain: [0, 4],
          frequency: 1,
          kind: "sin",
          phase: 0,
          shift: 0,
        },
        labels: [{ text: "sin" }],
      },
    ]);

    expect(rest).toEqual([]);
    expect(line?.labels).toEqual([{ text: "sin" }]);
    expect(line?.points).toHaveLength(400);
  });

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
      smooth: false,
    });
    expect(lines[1]?.points.length).toBeGreaterThan(4);
    expect(lines[2]).toMatchObject({ smooth: false });
    expect(lines[2]?.points).toHaveLength(2);
    expect(lines[3]).toMatchObject({ smooth: false });
    expect(lines[3]?.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(lines[4]).toMatchObject({
      color: "amber",
      showPoints: false,
      smooth: false,
    });
    expect(lines[5]).toMatchObject({ smooth: false });
    expect(lines[6]).toMatchObject({ smooth: false });
    expect(Arr.drop(lines, 7)).toHaveLength(12);
    expect(Arr.drop(lines, 7)).toSatisfy((cuboidLines: typeof lines) =>
      Arr.every(
        cuboidLines,
        (line) =>
          line.color === "slategray" &&
          line.points.length === 2 &&
          line.showPoints === false &&
          line.smooth === false
      )
    );
  });
});

describe("line scene configuration", () => {
  it("resolves the authored lines and keeps the default camera and axis", () => {
    const config = resolveLineScene({ data: [rawLine] });

    expect(config.cameraPosition).toEqual([10, 6, 10]);
    expect(config).not.toHaveProperty("cameraTarget");
    expect(config.showZAxis).toBe(true);
    expect(config.lines).toEqual([rawLine]);
  });

  it("keeps the camera and the axis the author sets", () => {
    const config = resolveLineScene({
      cameraPosition: [1, 2, 3],
      cameraTarget: [4, 5, 6],
      data: [rawLine],
      showZAxis: false,
    });

    expect(config).toMatchObject({
      cameraPosition: [1, 2, 3],
      cameraTarget: [4, 5, 6],
      showZAxis: false,
    });
  });
});

describe("line scene summary", () => {
  it("counts the lines and spans every point on each axis", () => {
    const summary = summarizeLines([
      {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 2, y: -1, z: 3 },
        ],
      },
      { points: [{ x: -1, y: 4, z: 3 }] },
    ]);

    expect(summary).toEqual(
      Option.some({
        count: 2,
        x: { max: 2, min: -1 },
        y: { max: 4, min: -1 },
        z: { max: 3, min: 0 },
      })
    );
  });

  it("has no summary when the lines have no points", () => {
    expect(summarizeLines([])).toEqual(Option.none());
    expect(summarizeLines([{ points: [] }])).toEqual(Option.none());
  });
});
