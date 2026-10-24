// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { CurveError } from "@repo/design-system/components/contents/mathematics/line/curve";
import {
  resolveAuthoredLines,
  resolveLineScene,
  summarizeLines,
} from "@repo/design-system/components/contents/mathematics/line/resolve";
import { Array as Arr, Effect, Option } from "effect";

const rawLine = {
  color: "blue",
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ],
};

describe("authored mathematical lines", () => {
  it.effect(
    "resolves a curve into one smooth-free line per drawn branch, labelling the middle one",
    () =>
      Effect.gen(function* () {
        const lines = yield* resolveAuthoredLines([
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
        expect(Arr.map(lines, (line) => line.color)).toEqual([
          "green",
          "green",
          "green",
        ]);
        expect(Arr.map(lines, (line) => line.smooth)).toEqual([
          false,
          false,
          false,
        ]);
        expect(Arr.map(lines, (line) => line.labels)).toEqual([
          undefined,
          [{ text: "tan" }],
          undefined,
        ]);
        expect(Arr.every(lines, (line) => line.points.length > 0)).toBe(true);
      })
  );

  it.effect(
    "resolves a sine curve into one line that keeps its style on the default grid",
    () =>
      Effect.gen(function* () {
        const lines = yield* resolveAuthoredLines([
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

        expect(Arr.map(lines, (line) => line.labels)).toEqual([
          [{ text: "sin" }],
        ]);
        expect(Arr.map(lines, (line) => line.points.length)).toEqual([200]);
      })
  );

  it.effect(
    "places each label on the drawn branch that holds its anchor, re-based to that branch",
    () =>
      Effect.gen(function* () {
        const lines = yield* resolveAuthoredLines([
          {
            curve: {
              amplitude: 1,
              domain: [-Math.PI, Math.PI],
              frequency: 1,
              kind: "tan",
              phase: 0,
              samples: 322,
              shift: 0,
            },
            labels: [{ at: 300, text: "right" }],
          },
        ]);

        const [, , right] = lines;
        const label = Option.getOrThrow(Arr.get(right?.labels ?? [], 0));
        const anchored = Option.getOrThrow(
          Arr.get(right?.points ?? [], label.at ?? -1)
        );
        expect(lines[0]?.labels).toBeUndefined();
        expect(lines[1]?.labels).toBeUndefined();
        expect(anchored.x).toBeCloseTo(-Math.PI + (2 * Math.PI * 300) / 321, 9);
      })
  );

  it.effect(
    "fails a label whose anchor no drawn branch holds, rather than dropping it",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          resolveAuthoredLines([
            {
              curve: {
                amplitude: 1,
                domain: [-1.5, 1.5],
                frequency: 1,
                kind: "tan",
                phase: 0,
                samples: 200,
                shift: 0,
              },
              labels: [{ at: 0, text: "clipped" }],
            },
          ])
        );

        expect(error).toBeInstanceOf(CurveError);
        expect(error.message).toContain("grid index 0");
      })
  );

  it.effect("fails a curve that carries labels but draws no branch", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveAuthoredLines([
          {
            curve: {
              amplitude: 1,
              domain: [1.5, 1.55],
              frequency: 1,
              kind: "tan",
              phase: 0,
              shift: 0,
            },
            labels: [{ text: "lost" }],
          },
        ])
      );

      expect(error).toBeInstanceOf(CurveError);
      expect(error.message).toContain("draws none");
    })
  );

  it.effect("fails an invalid curve declaration before it is sampled", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveAuthoredLines([
          {
            curve: {
              amplitude: 1,
              domain: [0, 1],
              frequency: 0,
              kind: "sin",
              phase: 0,
              shift: 0,
            },
          },
        ])
      );

      expect(error).toBeInstanceOf(CurveError);
    })
  );

  it.effect(
    "preserves concrete line data and resolves every declarative primitive",
    () =>
      Effect.gen(function* () {
        const lines = yield* resolveAuthoredLines([
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
      })
  );
});

describe("line scene configuration", () => {
  it.effect(
    "resolves the authored lines and keeps the default camera and axis",
    () =>
      Effect.gen(function* () {
        const config = yield* resolveLineScene({ data: [rawLine] });

        expect(config.cameraPosition).toEqual([10, 6, 10]);
        expect(config).not.toHaveProperty("cameraTarget");
        expect(config.showZAxis).toBe(true);
        expect(config.lines).toEqual([rawLine]);
      })
  );

  it.effect("keeps the camera and the axis the author sets", () =>
    Effect.gen(function* () {
      const config = yield* resolveLineScene({
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
    })
  );
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
