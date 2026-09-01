import { describe, expect, it } from "@effect/vitest";
import {
  type CoordinateTuple,
  createAxisGeometry,
  createGridGeometry,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";

const asymmetricFrame = {
  x: { max: 1.8, min: -0.9 },
  y: { max: 2.2, min: -1.1 },
  z: { max: 1.3, min: -0.7 },
};

function expectWorldAligned(
  points: readonly CoordinateTuple[],
  firstAxis: 0 | 1 | 2,
  secondAxis: 0 | 1 | 2
) {
  for (let index = 0; index < points.length; index += 2) {
    const start = points[index];
    const end = points[index + 1];
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (!(start && end)) {
      continue;
    }

    const fixedAxis =
      start[firstAxis] === end[firstAxis] ? firstAxis : secondAxis;
    expect((start[fixedAxis] * 2) % 1).toBeCloseTo(0, 12);
  }
}

describe("coordinate frame geometry", () => {
  it("preserves the original symmetric frame", () => {
    expect(createSymmetricFrame(6)).toEqual({
      x: { max: 6, min: -6 },
      y: { max: 6, min: -6 },
      z: { max: 6, min: -6 },
    });
  });

  it("uses the exact authored axis endpoints", () => {
    const axes = createAxisGeometry(asymmetricFrame, 0.5);

    expect(axes.x).toMatchObject({
      from: { x: -0.9, y: 0, z: 0 },
      to: { x: 1.8, y: 0, z: 0 },
      visible: true,
    });
    expect(axes.y).toMatchObject({
      from: { x: 0, y: -1.1, z: 0 },
      to: { x: 0, y: 2.2, z: 0 },
      visible: true,
    });
    expect(axes.z).toMatchObject({
      from: { x: 0, y: 0, z: -0.7 },
      to: { x: 0, y: 0, z: 1.3 },
      visible: true,
    });
  });

  it("omits labels and axes that are outside one-sided frames", () => {
    const positive = createAxisGeometry(
      {
        x: { max: 3, min: 1 },
        y: { max: 4, min: 2 },
        z: { max: 5, min: 3 },
      },
      0.5
    );
    const negative = createAxisGeometry(
      {
        x: { max: -1, min: -3 },
        y: { max: -2, min: -4 },
        z: { max: -3, min: -5 },
      },
      0.5
    );

    expect(positive.x).toMatchObject({
      negativeLabel: undefined,
      visible: false,
    });
    expect(positive.y).toMatchObject({
      negativeLabel: undefined,
      visible: false,
    });
    expect(positive.z).toMatchObject({
      negativeLabel: undefined,
      visible: false,
    });
    expect(negative.x).toMatchObject({
      positiveLabel: undefined,
      visible: false,
    });
    expect(negative.y).toMatchObject({
      positiveLabel: undefined,
      visible: false,
    });
    expect(negative.z).toMatchObject({
      positiveLabel: undefined,
      visible: false,
    });
  });

  it("anchors every exact grid line to global Cartesian coordinates", () => {
    const grid = createGridGeometry(asymmetricFrame);

    expectWorldAligned([...grid.xy.cells, ...grid.xy.sections], 0, 1);
    expectWorldAligned([...grid.xz.cells, ...grid.xz.sections], 0, 2);
    expectWorldAligned([...grid.yz.cells, ...grid.yz.sections], 1, 2);
    expect(grid.xy.boundary).toEqual([
      [-0.9, -1.1, 0],
      [1.8, -1.1, 0],
      [1.8, -1.1, 0],
      [1.8, 2.2, 0],
      [1.8, 2.2, 0],
      [-0.9, 2.2, 0],
      [-0.9, 2.2, 0],
      [-0.9, -1.1, 0],
    ]);
  });

  it("shows only planes contained by the authored frame", () => {
    const grid = createGridGeometry({
      x: { max: 3, min: 1 },
      y: { max: 4, min: -2 },
      z: { max: 5, min: -1 },
    });

    expect(grid.xy.visible).toBe(true);
    expect(grid.xz.visible).toBe(true);
    expect(grid.yz.visible).toBe(false);
  });

  it("keeps large exact frames bounded without fading", () => {
    const grid = createGridGeometry({
      x: { max: 1000, min: -1000 },
      y: { max: 1000, min: -1000 },
      z: { max: 1000, min: -1000 },
    });

    expect(grid.xy.cells.length + grid.xy.sections.length).toBeLessThanOrEqual(
      804
    );
    expect(grid.xy.boundary).toHaveLength(8);
  });

  it.each([
    [300, 2],
    [700, 5],
    [1500, 10],
  ])("selects a bounded nice step for an extent of %s", (extent, step) => {
    const half = extent / 2;
    const grid = createGridGeometry({
      x: { max: half, min: -half },
      y: { max: half, min: -half },
      z: { max: half, min: -half },
    });
    const points = [...grid.xy.cells, ...grid.xy.sections];
    const verticalLines = points
      .flatMap((point, index) =>
        index % 2 === 0 && point[0] === points[index + 1]?.[0] ? [point[0]] : []
      )
      .sort((left, right) => left - right);
    const [first, second] = verticalLines;

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first !== undefined && second !== undefined) {
      expect(second - first).toBe(step);
    }
  });

  it("bounds the widest finite grid and keeps every coordinate finite", () => {
    const frame = {
      x: { max: 1e308, min: -1e308 },
      y: { max: 1e308, min: -1e308 },
      z: { max: 1e308, min: -1e308 },
    };
    const grid = createGridGeometry(frame);
    const axes = createAxisGeometry(frame, Number.MAX_VALUE);
    const coordinates = [
      ...grid.xy.boundary,
      ...grid.xy.cells,
      ...grid.xy.sections,
      ...grid.xz.boundary,
      ...grid.xz.cells,
      ...grid.xz.sections,
      ...grid.yz.boundary,
      ...grid.yz.cells,
      ...grid.yz.sections,
    ].flat();

    expect(coordinates.every(Number.isFinite)).toBe(true);
    expect(grid.xy.cells.length + grid.xy.sections.length).toBeLessThanOrEqual(
      808
    );
    expect(
      [
        axes.x.negativeLabel?.x,
        axes.x.positiveLabel?.x,
        axes.y.negativeLabel?.y,
        axes.y.positiveLabel?.y,
        axes.z.negativeLabel?.z,
        axes.z.positiveLabel?.z,
      ].every((value) => value !== undefined && Number.isFinite(value))
    ).toBe(true);
  });

  it("terminates when a subnormal range cannot advance by half units", () => {
    const minimum = Number.MIN_VALUE;
    const grid = createGridGeometry({
      x: { max: minimum, min: -minimum },
      y: { max: minimum, min: -minimum },
      z: { max: minimum, min: -minimum },
    });

    expect(grid.xy.cells.length + grid.xy.sections.length).toBeLessThanOrEqual(
      8
    );
    expect(
      [...grid.xy.cells, ...grid.xy.sections].flat().every(Number.isFinite)
    ).toBe(true);
  });

  it("deduplicates ticks when a valid finite range is below its cell step", () => {
    const adjacent = {
      max: 1.000_000_000_000_000_2e308,
      min: 1e308,
    };
    const grid = createGridGeometry({
      x: adjacent,
      y: adjacent,
      z: adjacent,
    });
    const points = [...grid.xy.cells, ...grid.xy.sections];
    const segments = Array.from({ length: points.length / 2 }, (_, index) =>
      points.slice(index * 2, index * 2 + 2)
    );

    expect(points.length).toBeLessThanOrEqual(8);
    expect(
      new Set(segments.map((segment) => JSON.stringify(segment))).size
    ).toBe(segments.length);
  });
});
