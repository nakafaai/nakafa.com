import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  newShape,
  type ShapeDraft,
  type ShapeKind,
} from "@/components/tenant/exams/figure/shapes";
import {
  SPACE_KINDS,
  spaceAnchorOf,
  spaceObjectOf,
  spaceSpotsOf,
} from "@/components/tenant/exams/figure/space";

/** A new shape of a kind with some of its fields typed over. */
const shape = (kind: ShapeKind, fields: Partial<ShapeDraft> = {}) => ({
  ...newShape(kind, `${kind}-1`, 0),
  ...fields,
});

describe("exams/figure/space", () => {
  it("draws every kind it lists in 3D from where it starts, and nothing of a kind only a plane draws", () => {
    for (const kind of SPACE_KINDS) {
      expect(Option.isSome(spaceObjectOf(shape(kind)))).toBe(true);
    }
    expect(Option.isNone(spaceObjectOf(shape("circle")))).toBe(true);
  });

  it("makes each object in space from its fields, the surface over a square of its range", () => {
    const ends = { x2: "1", y2: "2", z2: "3" };
    expect(spaceObjectOf(shape("point", { z: "2" }))).toEqual(
      Option.some({ at: { x: 0, y: 0, z: 2 }, kind: "point" })
    );
    expect(spaceObjectOf(shape("line", ends))).toEqual(
      Option.some({
        kind: "line",
        through: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 2, z: 3 },
        ],
      })
    );
    expect(spaceObjectOf(shape("ray", ends))).toEqual(
      Option.some({
        from: { x: 0, y: 0, z: 0 },
        kind: "ray",
        through: { x: 1, y: 2, z: 3 },
      })
    );
    expect(spaceObjectOf(shape("vector", ends))).toEqual(
      Option.some({
        from: { x: 0, y: 0, z: 0 },
        kind: "vector",
        to: { x: 1, y: 2, z: 3 },
      })
    );
    expect(spaceObjectOf(shape("function", { formula: "x y" }))).toEqual(
      Option.some({
        domain: { x: { max: 2, min: -2 }, y: { max: 2, min: -2 } },
        formula: "x y",
        kind: "function",
      })
    );
    expect(Option.isNone(spaceObjectOf(shape("segment", { z2: "" })))).toBe(
      true
    );
  });

  it("places a label at a point or the middle of a segment, and nowhere on a surface", () => {
    expect(spaceAnchorOf(shape("point", { z: "1" }))).toEqual(
      Option.some({ x: 0, y: 0, z: 1 })
    );
    expect(spaceAnchorOf(shape("ray", { x2: "2", y2: "2", z2: "2" }))).toEqual(
      Option.some({ x: 1, y: 1, z: 1 })
    );
    expect(Option.isNone(spaceAnchorOf(shape("function")))).toBe(true);
  });

  it("holds every point of an object in the frame, a surface's heights where it has them", () => {
    expect(spaceSpotsOf(shape("point", { z: "1" }), {})).toEqual([
      { x: 0, y: 0, z: 1 },
    ]);
    expect(spaceSpotsOf(shape("line"), {})).toHaveLength(2);
    expect(spaceSpotsOf(shape("ray"), {})).toHaveLength(2);
    expect(spaceSpotsOf(shape("vector"), {})).toHaveLength(2);
    expect(spaceSpotsOf(shape("circle"), {})).toEqual([]);
    const surface = spaceSpotsOf(
      shape("function", { formula: "a x", from: "0", to: "1" }),
      { a: 2 }
    );
    expect(surface).toHaveLength(81);
    expect(surface[80]).toEqual({ x: 1, y: 1, z: 2 });
    expect(
      spaceSpotsOf(
        shape("function", { formula: "1/x", from: "0", to: "1" }),
        {}
      )
    ).toHaveLength(72);
    expect(spaceSpotsOf(shape("function", { formula: "x +" }), {})).toEqual([]);
  });
});
