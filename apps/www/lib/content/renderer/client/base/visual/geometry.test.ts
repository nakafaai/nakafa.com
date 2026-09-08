import { describe, expect, it } from "@effect/vitest";

import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

function plane(first: PlaneObject, ...rest: PlaneObject[]): PlaneVisual {
  return {
    frame: {
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
  it("clips plane lines and preserves their direction", () => {
    const geometry = resolveVisualGeometry(
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
    expect(geometry).toEqual({
      markers: [],
      regions: [],
      paths: [
        {
          appearance: "primary",
          arrows: "both",
          id: "line",
          points: [
            { x: -4, y: -4, z: 0 },
            { x: 4, y: 4, z: 0 },
          ],
        },
      ],
    });
  });
  it("preserves an exact plane corner tangent and omits a zero-length path", () => {
    const geometry = resolveVisualGeometry(
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
    expect(geometry).toEqual({
      paths: [],
      regions: [],
      markers: [
        { appearance: "primary", at: { x: 5, y: 4, z: 0 }, id: "tangent" },
      ],
    });
  });
  it("clips finite plane paths and omits markers outside the frame", () => {
    const geometry = resolveVisualGeometry(
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
    expect(geometry.markers).toEqual([]);
    expect(geometry.paths).toMatchObject([
      {
        id: "polyline",
        points: [
          { x: -5, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 0, z: 0 },
        ],
      },
    ]);
  });
  it("shares polygon vertices between its region and closed outline", () => {
    const geometry = resolveVisualGeometry(
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
    const vertices = [
      { x: -2, y: -1, z: 0 },
      { x: 2, y: -1, z: 0 },
      { x: 0, y: 3, z: 0 },
    ];
    expect(geometry.regions).toEqual([
      { appearance: "answer", id: "triangle", vertices },
    ]);
    expect(geometry.paths).toEqual([
      {
        appearance: "answer",
        arrows: "none",
        id: "triangle",
        points: [...vertices, vertices[0]],
      },
    ]);
  });
  it("samples a quadratic from its function without bending the result", () => {
    const geometry = resolveVisualGeometry(
      plane({
        appearance: "primary",
        coefficients: { a: 1, b: 0, c: 0 },
        domain: { max: 2, min: -2 },
        id: "parabola",
        inputAxis: "x",
        kind: "quadratic",
      })
    );
    expect(geometry.paths).toHaveLength(1);
    for (const point of geometry.paths[0].points) {
      expect(point.y).toBeCloseTo(point.x ** 2, 12);
      expect(point.z).toBe(0);
    }
    expect(geometry.paths[0].points[0]).toEqual({ x: -2, y: 4, z: 0 });
    expect(geometry.paths[0].points.at(-1)).toEqual({ x: 2, y: 4, z: 0 });
  });
  it("creates twelve straight cuboid edges with collision-free IDs", () => {
    const geometry = resolveVisualGeometry(
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

  it("clips every cuboid edge to the authored frame before projection", () => {
    const visual = space({
      appearance: "primary",
      center: { x: 5, y: 0, z: 0 },
      id: "clipped-box",
      kind: "cuboid",
      size: { height: 4, length: 4, width: 4 },
    });
    const projection = resolveVisualProjection(visual);
    const frame = projectVisualFrame(visual, projection);
    const geometry = resolveVisualGeometry(visual, projection);

    expect(geometry.markers).toEqual([]);
    expect(geometry.paths).toHaveLength(8);
    expect(geometry.paths.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining([
        "clipped-box:edge:2",
        "clipped-box:edge:6",
        "clipped-box:edge:10",
        "clipped-box:edge:11",
      ])
    );
    for (const { points } of geometry.paths) {
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(frame.x.min);
        expect(point.x).toBeLessThanOrEqual(frame.x.max);
        expect(point.y).toBeGreaterThanOrEqual(frame.y.min);
        expect(point.y).toBeLessThanOrEqual(frame.y.max);
        expect(point.z).toBeGreaterThanOrEqual(frame.z.min);
        expect(point.z).toBeLessThanOrEqual(frame.z.max);
      }
    }
  });

  it("preserves an exact space corner tangent as a marker", () => {
    const geometry = resolveVisualGeometry(
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
    const geometry = resolveVisualGeometry(
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
        kind: "cartesian",
        x: { max: 1e308, min: -1e308 },
        y: { max: 1e308, min: -1e308 },
      },
    } satisfies PlaneVisual;

    expect(resolveVisualGeometry(visual).paths).toMatchObject([
      {
        points: [
          { x: -5, y: -5, z: 0 },
          { x: 5, y: 5, z: 0 },
        ],
      },
    ]);
  });

  it("projects a subnormal cuboid into twelve non-degenerate GPU edges", () => {
    const minimum = Number.MIN_VALUE;
    const visual = {
      frame: {
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
    const geometry = resolveVisualGeometry(visual);

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
