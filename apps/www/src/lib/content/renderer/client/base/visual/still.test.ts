import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
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

  it("frames every point it draws, with a margin around them", () => {
    const drawn = still(
      plane({ ...fields, at: { x: 0, y: 0 }, id: "o", kind: "point" })
    );
    const points = [
      ...Arr.flatMap(drawn.axes, ({ points }) => points),
      ...Arr.map(drawn.dots, ({ at }) => at),
    ];
    for (const [x, y] of points) {
      expect(x).toBeGreaterThan(drawn.view.left);
      expect(x).toBeLessThan(drawn.view.left + drawn.view.width);
      expect(y).toBeGreaterThan(drawn.view.top);
      expect(y).toBeLessThan(drawn.view.top + drawn.view.height);
    }
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
    const region = Arr.filter(drawn.strokes, ({ id }) => id.startsWith("half"));
    expect(Arr.some(region, ({ filled }) => filled)).toBe(true);
    expect(Arr.some(region, ({ filled }) => !filled)).toBe(true);
    expect(
      Arr.map(drawn.labels, ({ key, placement }) => [key, placement])
    ).toStrictEqual([["a", "center"]]);
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
