import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import { drawStill } from "@/lib/content/renderer/client/base/visual/still";
import { resolveVisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import { plane, space } from "@/test/scene";

const fields = { appearance: "primary" } as const;

/** Draws a scene's still at the given slider values. */
function still(
  scene: PlaneVisual | SpaceVisual,
  scope: Readonly<Record<string, number>> = {}
) {
  return drawStill(scene, resolveVisualProjection(scene), scope);
}

describe("the still of a MathVisual scene", () => {
  it("draws a plane scene flat, x right and y up, with its axes, objects and labels", () => {
    const drawn = still({
      ...plane(
        {
          ...fields,
          id: "edge",
          kind: "segment",
          from: { x: -2, y: 0 },
          to: { x: 2, y: 2 },
        },
        {
          appearance: "secondary",
          id: "shape",
          kind: "polygon",
          vertices: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
        },
        { appearance: "answer", at: { x: 3, y: -1 }, id: "p", kind: "point" }
      ),
      labels: [
        { at: { x: 3, y: -1 }, key: "p", objectId: "p", placement: "above" },
        { at: { x: "1 / 0", y: "0" }, key: "hidden", objectId: "edge" },
      ],
    });

    expect(drawn.axes).toHaveLength(2);
    const [segment] = Arr.filter(drawn.strokes, ({ id }) => id === "edge");
    expect(segment?.closed).toBe(false);
    const [from, to] = segment?.points ?? [];
    expect((to?.[0] ?? 0) > (from?.[0] ?? 0)).toBe(true);
    expect((to?.[1] ?? 0) > (from?.[1] ?? 0)).toBe(true);
    // A polygon fills its region and draws its outline.
    expect(
      Arr.map(
        Arr.filter(drawn.strokes, ({ id }) => id === "shape"),
        ({ closed, filled }) => [closed, filled]
      )
    ).toStrictEqual([
      [true, true],
      [false, false],
    ]);
    expect(
      Arr.map(drawn.dots, ({ appearance, id }) => [id, appearance])
    ).toStrictEqual([["p", "answer"]]);
    // A label whose formula is not finite places nothing; the other takes its owner's color.
    expect(
      Arr.map(drawn.labels, ({ appearance, key, placement }) => [
        key,
        appearance,
        placement,
      ])
    ).toStrictEqual([["p", "answer", "above"]]);
    expect(drawn.labels[0]?.at).toStrictEqual(drawn.dots[0]?.at);
  });

  it("frames the padded frame and what it draws, while its axes run on past the drawing", () => {
    const drawn = still(
      plane({ ...fields, at: { x: 0, y: 0 }, id: "o", kind: "point" })
    );
    const inside = ([x, y]: readonly [number, number]) =>
      x > drawn.view.left &&
      x < drawn.view.left + drawn.view.width &&
      y > drawn.view.top &&
      y < drawn.view.top + drawn.view.height;
    expect(Arr.every(drawn.dots, ({ at }) => inside(at))).toBe(true);
    // The axes cross at the origin and reach 30 units each way, far past the drawing's edges.
    expect(
      Arr.map(drawn.axes, ({ axis, points }) => [axis, points])
    ).toStrictEqual([
      [
        "x",
        [
          [-30, 0],
          [30, 0],
        ],
      ],
      [
        "y",
        [
          [0, -30],
          [0, 30],
        ],
      ],
    ]);
    expect(Option.isSome(drawn.grid)).toBe(true);
    expect(drawn.ticks.length).toBeGreaterThan(0);
  });

  it("frames a frame far from zero by itself, numbering its axes at the grid's major lines", () => {
    const drawn = still({
      ...plane({
        ...fields,
        formula: "37 + sin(x)",
        id: "c",
        kind: "function",
      }),
      frame: {
        kind: "cartesian",
        x: { max: 5, min: 0 },
        y: { max: 39, min: 35 },
      },
    });

    // The frame spans 10 by 8 scene units around its middle; y = 0 lies 74 below it, past the reach.
    expect(drawn.view).toStrictEqual({
      height: 9.2,
      left: -5.6,
      top: -4.6,
      width: 11.2,
    });
    // Only the y axis, at x = 0, passes through the reach; the x axis is never in view.
    expect(
      Arr.map(drawn.axes, ({ axis, points }) => [axis, points])
    ).toStrictEqual([
      [
        "y",
        [
          [-5, -30],
          [-5, 30],
        ],
      ],
    ]);
    // One unit takes 2 scene units, and 4.6 units across the drawing's short side give a major step of 2.
    expect(drawn.grid).toStrictEqual(
      Option.some({ major: [4, 4], minor: [1, 1], origin: [-5, -74] })
    );
    // Each number stands on its axis's line, which the card keeps it beside or sticks to its edge.
    expect(
      Arr.map(drawn.ticks, ({ at, axis, value }) => [axis, value, at])
    ).toStrictEqual([
      ["x", 2, [-1, -74]],
      ["x", 4, [3, -74]],
      ["x", 6, [7, -74]],
      ["y", 34, [-5, -6]],
      ["y", 36, [-5, -2]],
      ["y", 38, [-5, 2]],
      ["y", 40, [-5, 6]],
    ]);
  });

  it("numbers no axis and draws no grid for a space scene", () => {
    const drawn = still(
      space({
        ...fields,
        at: { x: 1, y: 1, z: 1 },
        id: "p",
        kind: "point",
      })
    );
    expect(Option.isNone(drawn.grid)).toBe(true);
    expect(drawn.ticks).toStrictEqual([]);
    expect(Arr.map(drawn.axes, ({ axis }) => axis)).toStrictEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("dashes the lines and graphs the scene dashes, and draws the rest solid", () => {
    const drawn = still(
      plane(
        {
          ...fields,
          id: "boundary",
          kind: "line",
          stroke: "dashed",
          through: [
            { x: 0, y: 2 },
            { x: 5, y: 0 },
          ],
        },
        { ...fields, formula: "x / 2", id: "rate", kind: "function" },
        {
          ...fields,
          formula: "1 - x",
          id: "edge",
          kind: "function",
          stroke: "dashed",
        }
      )
    );
    expect(
      Arr.map(drawn.strokes, ({ dashed, id }) => [id, dashed])
    ).toStrictEqual([
      ["boundary", true],
      ["rate", false],
      ["edge", true],
    ]);
  });

  it("draws formula curves, markers and regions at the sliders' values", () => {
    const drawn = still(
      {
        ...plane(
          { ...fields, formula: "a x", id: "line", kind: "function" },
          { ...fields, id: "tip", kind: "marker", x: "a", y: "0" },
          { ...fields, id: "half", inequalities: ["y < x"], kind: "region" },
          { ...fields, at: { x: 0, y: 0 }, id: "o", kind: "point" }
        ),
        labels: [{ at: { x: "a", y: "1" }, key: "a", objectId: "tip" }],
      },
      { a: 2 }
    );
    expect(Arr.some(drawn.strokes, ({ id }) => id === "line")).toBe(true);
    expect(Arr.map(drawn.dots, ({ id }) => id)).toStrictEqual(["o", "tip"]);
    // A region shades one area under its stroked edges, dashed where the inequality is strict, as the scene draws them.
    const edges = Arr.filter(drawn.strokes, ({ id }) => id.startsWith("half"));
    expect(edges.length).toBeGreaterThan(0);
    expect(Arr.every(edges, ({ filled }) => !filled)).toBe(true);
    expect(Arr.every(edges, ({ dashed }) => dashed)).toBe(true);
    expect(Arr.map(drawn.areas, ({ id }) => id)).toStrictEqual(["half"]);
    expect(
      Arr.map(drawn.labels, ({ key, placement }) => [key, placement])
    ).toStrictEqual([["a", "center"]]);
  });

  it("writes a region that fills the frame and its sampled curves in a few kilobytes", () => {
    // The orthogonal projection lesson's scene: its regions' joined cells, one <polygon> each, wrote 200 KB.
    const drawn = still({
      ...plane(
        {
          ...fields,
          id: "above",
          inequalities: ["y <= x^2", "y >= 1/3", "x >= -1", "x <= 1"],
          kind: "region",
        },
        {
          ...fields,
          id: "below",
          inequalities: ["y >= x^2", "y <= 1/3"],
          kind: "region",
        },
        {
          ...fields,
          domain: { max: 1, min: -1 },
          formula: "1/3",
          id: "flat",
          kind: "function",
        }
      ),
      frame: {
        kind: "cartesian",
        x: { max: 1.2, min: -1.2 },
        y: { max: 1.15, min: -0.2 },
      },
    });
    const written = (points: readonly (readonly [number, number])[]) =>
      Arr.join(
        Arr.map(points, ([x, y]) => `${x},${-y}`),
        " "
      ).length;
    const bytes =
      Arr.reduce(drawn.areas, 0, (sum, { rings }) =>
        Arr.reduce(rings, sum, (total, ring) => total + written(ring))
      ) +
      Arr.reduce(drawn.strokes, 0, (sum, { points }) => sum + written(points));
    expect(bytes).toBeLessThan(60_000);
    // Edges of inclusive inequalities stay solid, and so does every curve.
    expect(Arr.some(drawn.strokes, ({ dashed }) => dashed)).toBe(false);
    // A flat line keeps its two ends, however many points sampled it.
    const [flat] = Arr.filter(drawn.strokes, ({ id }) => id === "flat");
    expect(flat?.points).toHaveLength(2);
  });

  it("draws a space scene's three axes, its surfaces as rows and its solids as faces", () => {
    const drawn = still(
      space(
        { ...fields, formula: "x y / 8", id: "saddle", kind: "function" },
        {
          ...fields,
          base: [
            { x: 0, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 0, y: 2, z: 0 },
          ],
          id: "prism",
          kind: "prism",
          offset: { x: 0, y: 0, z: 2 },
        }
      )
    );
    expect(drawn.axes).toHaveLength(3);
    // The surface reads as a wireframe of rows and columns, about ten each way.
    const rows = Arr.filter(drawn.strokes, ({ id }) =>
      id.startsWith("saddle:row:")
    );
    const columns = Arr.filter(drawn.strokes, ({ id }) =>
      id.startsWith("saddle:column:")
    );
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.length).toBeLessThanOrEqual(12);
    expect(columns.length).toBeGreaterThan(2);
    expect(columns.length).toBeLessThanOrEqual(12);
    expect(
      Arr.every(
        Arr.filter(drawn.strokes, ({ id }) => id.startsWith("prism:face:")),
        ({ closed, filled }) => closed && filled
      )
    ).toBe(true);
  });

  it("still draws the axes and objects of a scene whose formula does not read", () => {
    const drawn = still(
      plane(
        { ...fields, formula: "2 +", id: "broken", kind: "function" },
        { ...fields, at: { x: 1, y: 1 }, id: "p", kind: "point" }
      )
    );
    expect(drawn.axes).toHaveLength(2);
    expect(Arr.map(drawn.dots, ({ id }) => id)).toStrictEqual(["p"]);
    expect(Arr.some(drawn.strokes, ({ id }) => id === "broken")).toBe(false);
  });

  it("keeps a camera that looks straight down or up the y axis upright", () => {
    const scene = (y: number): SpaceVisual => ({
      ...space({ ...fields, at: { x: 2, y: 0, z: 1 }, id: "p", kind: "point" }),
      view: {
        kind: "camera",
        position: { x: 0, y, z: 0 },
        target: { x: 0, y: 0, z: 0 },
      },
    });
    const [down] = still(scene(5)).dots;
    const [up] = still(scene(-5)).dots;
    expect(Number.isFinite(down?.at[0])).toBe(true);
    expect(Number.isFinite(up?.at[0])).toBe(true);
    // Looking down or up y, the point's depth along z reads as up or down on the still.
    expect(Math.sign(down?.at[1] ?? 0)).toBe(-Math.sign(up?.at[1] ?? 0));
  });
});
