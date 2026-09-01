import { describe, expect, it } from "@effect/vitest";

import {
  resolvePlaneGeometry,
  resolveSpaceGeometry,
} from "@/lib/content/renderer/client/base/visual/geometry";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

function plane(first: PlaneObject, ...rest: PlaneObject[]): PlaneVisual {
  return {
    frame: {
      axes: "visible",
      grid: "visible",
      kind: "cartesian",
      x: { max: 5, min: -5 },
      y: { max: 4, min: -4 },
    },
    objects: [first, ...rest],
    space: "plane",
    view: { kind: "fit" },
  };
}

function space(first: SpaceObject, ...rest: SpaceObject[]): SpaceVisual {
  return {
    frame: {
      axes: "visible",
      grid: "visible",
      kind: "cartesian",
      x: { max: 6, min: -6 },
      y: { max: 5, min: -5 },
      z: { max: 4, min: -4 },
    },
    objects: [first, ...rest],
    space: "space",
    view: { kind: "fit" },
  };
}

describe("MathVisual geometry", () => {
  it("clips plane lines to exact frame boundaries", () => {
    const geometry = resolvePlaneGeometry(
      plane({
        appearance: "primary",
        id: "line",
        kind: "line",
        through: [
          { x: -1, y: -1 },
          { x: 1, y: 1 },
        ],
      })
    );

    expect(geometry).toEqual([
      {
        appearance: "primary",
        arrows: "both",
        fill: false,
        id: "line",
        kind: "path",
        points: [
          { x: -4, y: -4 },
          { x: 4, y: 4 },
        ],
      },
    ]);
  });

  it("preserves an exact corner tangent and omits a zero-length path", () => {
    const geometry = resolvePlaneGeometry(
      plane(
        {
          appearance: "primary",
          id: "tangent",
          kind: "line",
          through: [
            { x: 5, y: 4 },
            { x: 6, y: 3 },
          ],
        },
        {
          appearance: "secondary",
          from: { x: 1, y: 1 },
          id: "zero",
          kind: "segment",
          to: { x: 1, y: 1 },
        }
      )
    );

    expect(geometry).toEqual([
      {
        appearance: "primary",
        at: { x: 5, y: 4 },
        id: "tangent",
        kind: "point",
      },
    ]);
  });

  it("clips finite plane paths and omits markers outside the frame", () => {
    const geometry = resolvePlaneGeometry(
      plane(
        {
          appearance: "answer",
          at: { x: 7, y: 0 },
          id: "outside",
          kind: "point",
        },
        {
          appearance: "construction",
          id: "polyline",
          kind: "polyline",
          vertices: [
            { x: -7, y: 0 },
            { x: 0, y: 0 },
            { x: 7, y: 0 },
          ],
        }
      )
    );

    expect(geometry).toMatchObject([
      {
        id: "polyline",
        points: [
          { x: -5, y: 0 },
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
      },
    ]);
  });

  it("preserves a valid closed plane polygon as a filled path", () => {
    const geometry = resolvePlaneGeometry(
      plane({
        appearance: "answer",
        id: "triangle",
        kind: "polygon",
        vertices: [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 0, y: 3 },
        ],
      })
    );

    expect(geometry).toEqual([
      {
        appearance: "answer",
        arrows: "none",
        fill: true,
        id: "triangle",
        kind: "path",
        points: [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 0, y: 3 },
          { x: -2, y: -1 },
        ],
      },
    ]);
  });

  it("preserves an exact quadratic primitive for affine SVG projection", () => {
    const geometry = resolvePlaneGeometry(
      plane({
        appearance: "primary",
        coefficients: { a: 1, b: 0, c: 0 },
        domain: { max: 2, min: -2 },
        id: "parabola",
        inputAxis: "x",
        kind: "quadratic",
      })
    );

    expect(geometry).toEqual([
      {
        appearance: "primary",
        coefficients: { a: 1, b: 0, c: 0 },
        domain: { max: 2, min: -2 },
        id: "parabola",
        inputAxis: "x",
        kind: "quadratic",
      },
    ]);
  });

  it("creates twelve straight cuboid edges with collision-free IDs", () => {
    const geometry = resolveSpaceGeometry(
      space(
        {
          appearance: "primary",
          center: { x: 0, y: 0, z: 0 },
          id: "box",
          kind: "cuboid",
          size: { height: 4, length: 6, width: 8 },
        },
        {
          appearance: "reference",
          from: { x: -1, y: 0, z: 0 },
          id: "box-edge-1",
          kind: "segment",
          to: { x: 1, y: 0, z: 0 },
        }
      )
    );
    const pathIds = geometry.paths.map(({ id }) => id);

    expect(geometry.paths).toHaveLength(13);
    expect(new Set(pathIds).size).toBe(pathIds.length);
    expect(pathIds).toContain("box:edge:1");
    expect(pathIds).toContain("box-edge-1");
    for (const path of geometry.paths.filter(({ id }) => id.includes(":"))) {
      const [start, end] = path.points;
      expect(start).toBeDefined();
      expect(end).toBeDefined();
      if (start && end) {
        const changedAxes = [
          start.x !== end.x,
          start.y !== end.y,
          start.z !== end.z,
        ].filter(Boolean);
        expect(changedAxes).toHaveLength(1);
      }
    }
  });

  it("preserves an exact space corner tangent as a marker", () => {
    const geometry = resolveSpaceGeometry(
      space({
        appearance: "secondary",
        id: "tangent",
        kind: "line",
        through: [
          { x: 6, y: 5, z: 4 },
          { x: 7, y: 4, z: 3 },
        ],
      })
    );

    expect(geometry.paths).toEqual([]);
    expect(geometry.markers).toEqual([
      {
        appearance: "secondary",
        at: { x: 5, y: 4.166_666_666_666_667, z: 3.333_333_333_333_333_5 },
        id: "tangent",
      },
    ]);
  });

  it("preserves a valid closed space polygon as path geometry", () => {
    const geometry = resolveSpaceGeometry(
      space({
        appearance: "construction",
        id: "face",
        kind: "polygon",
        vertices: [
          { x: -2, y: -1, z: 1 },
          { x: 2, y: -1, z: 1 },
          { x: 2, y: 2, z: 1 },
          { x: -2, y: 2, z: 1 },
        ],
      })
    );

    expect(geometry.markers).toEqual([]);
    expect(geometry.paths).toHaveLength(1);
    expect(geometry.paths[0]).toMatchObject({
      appearance: "construction",
      arrows: "none",
      id: "face",
    });
    expect(geometry.paths[0]?.points).toHaveLength(5);
    expect(geometry.paths[0]?.points[0]).toEqual(
      geometry.paths[0]?.points.at(-1)
    );
    expect(
      new Set(geometry.paths[0]?.points.map((point) => JSON.stringify(point)))
        .size
    ).toBe(4);
  });

  it("clips opposite finite extrema without losing the line direction", () => {
    const visual = {
      ...plane({
        appearance: "primary",
        id: "diameter",
        kind: "line",
        through: [
          { x: -1e308, y: -1e308 },
          { x: 1e308, y: 1e308 },
        ],
      }),
      frame: {
        axes: "visible",
        grid: "visible",
        kind: "cartesian",
        x: { max: 1e308, min: -1e308 },
        y: { max: 1e308, min: -1e308 },
      },
    } satisfies PlaneVisual;

    expect(resolvePlaneGeometry(visual)).toMatchObject([
      {
        points: [
          { x: -1e308, y: -1e308 },
          { x: 1e308, y: 1e308 },
        ],
      },
    ]);
  });

  it("projects a subnormal cuboid into twelve non-degenerate GPU edges", () => {
    const minimum = Number.MIN_VALUE;
    const visual = {
      frame: {
        axes: "visible",
        grid: "visible",
        kind: "cartesian",
        x: { max: minimum, min: -minimum },
        y: { max: minimum, min: -minimum },
        z: { max: minimum, min: -minimum },
      },
      objects: [
        {
          appearance: "primary",
          center: { x: 0, y: 0, z: 0 },
          id: "subnormal-box",
          kind: "cuboid",
          size: { height: minimum, length: minimum, width: minimum },
        },
      ],
      space: "space",
      view: { kind: "fit" },
    } satisfies SpaceVisual;
    const geometry = resolveSpaceGeometry(visual);

    expect(geometry.paths).toHaveLength(12);
    for (const path of geometry.paths) {
      const [from, to] = path.points;
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      expect(from).not.toEqual(to);
      expect(
        path.points.flatMap(({ x, y, z }) => [x, y, z]).every(Number.isFinite)
      ).toBe(true);
    }
  });
});
