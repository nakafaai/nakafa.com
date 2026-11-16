import { describe, expect, it } from "@effect/vitest";
import type { SpacePoint } from "@nakafa/aksara-contracts/math/base";
import { planeFormulaGeometry } from "@nakafa/aksara-contracts/math/formula/plane";
import { Array as Arr, Result } from "effect";
import { joinRegionFill } from "@/lib/content/renderer/client/base/visual/fill";

const point = (x: number, y: number, z = 0): SpacePoint => ({ x, y, z });

/** The axis-aligned square cell of a unit grid whose bottom left corner is at (x, y). */
const square = (x: number, y: number, z = 0) => [
  point(x, y, z),
  point(x + 1, y, z),
  point(x + 1, y + 1, z),
  point(x, y + 1, z),
];

/** The area a polygon encloses, by the shoelace formula. */
function area(shape: readonly SpacePoint[]) {
  const twice = Arr.reduce(shape, 0, (sum, current, index) => {
    const next = shape[(index + 1) % shape.length] ?? current;
    return sum + current.x * next.y - next.x * current.y;
  });
  return Math.abs(twice) / 2;
}

const total = (fill: readonly (readonly SpacePoint[])[]) =>
  Arr.reduce(fill, 0, (sum, shape) => sum + area(shape));

describe("joinRegionFill", () => {
  it("joins whole cells that touch in one row into one rectangle", () => {
    const joined = joinRegionFill([square(2, 0), square(0, 0), square(1, 0)]);

    expect(joined).toStrictEqual([
      [point(0, 0), point(3, 0), point(3, 1), point(0, 1)],
    ]);
  });

  it("keeps a gap in a row, rows apart, and planes apart", () => {
    const joined = joinRegionFill([
      square(0, 0),
      square(2, 0),
      square(0, 1),
      square(0, 0, 1),
    ]);

    expect(joined).toHaveLength(4);
    expect(total(joined)).toBe(4);
  });

  it("keeps every cell the edge cuts as it came", () => {
    const triangle = [point(0, 0), point(1, 0), point(0, 1)];
    const slanted = [point(0, 0), point(2, 0), point(3, 1), point(1, 1)];
    const tilted = [
      point(0, 0, 0),
      point(1, 0, 0),
      point(1, 1, 1),
      point(0, 1, 1),
    ];

    expect(
      joinRegionFill([square(5, 5), triangle, slanted, tilted])
    ).toStrictEqual([square(5, 5), triangle, slanted, tilted]);
  });

  it("fills a sampled region with a tenth of the shapes and the same area", () => {
    const box = {
      x: { max: 1.2, min: -1.2 },
      y: { max: 1.15, min: -0.2 },
      z: { max: 0, min: 0 },
    };
    const geometry = Result.getOrThrow(
      planeFormulaGeometry(
        {
          appearance: "answer",
          id: "below",
          inequalities: ["y >= x^2", "y <= 1/3"],
          kind: "region",
        },
        box,
        {}
      )
    );
    const sampled = geometry.kind === "region" ? geometry.fill : [];
    const joined = joinRegionFill(sampled);

    expect(joined.length * 10).toBeLessThan(sampled.length);
    expect(total(joined)).toBeCloseTo(total(sampled), 9);
  });
});
