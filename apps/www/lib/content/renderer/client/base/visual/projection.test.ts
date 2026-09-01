import { describe, expect, it } from "@effect/vitest";
import { BigDecimal } from "effect";
import { createPlaneArc } from "@/lib/content/renderer/client/base/visual/arc";
import type { ResolvedPlaneObject } from "@/lib/content/renderer/client/base/visual/geometry";
import {
  createPlanePoints,
  createPlaneQuadratic,
  createPlaneTicks,
  projectPlanePoint,
  projectPlaneRadius,
  resolvePlaneQuadratic,
  resolvePlaneViewport,
} from "@/lib/content/renderer/client/base/visual/projection";
import type { PlaneVisual } from "@/lib/content/renderer/client/base/visual/scene";

function scene(
  x: PlaneVisual["frame"]["x"],
  y: PlaneVisual["frame"]["y"]
): PlaneVisual {
  return {
    frame: {
      axes: "visible",
      grid: "visible",
      kind: "cartesian",
      x,
      y,
    },
    objects: [
      {
        appearance: "primary",
        at: { x: 0, y: 0 },
        id: "origin",
        kind: "point",
      },
    ],
    space: "plane",
    view: { kind: "fit" },
  };
}

function arc(
  sweepDegrees: number
): Extract<ResolvedPlaneObject, { readonly kind: "arc" }> {
  return {
    appearance: "primary",
    center: { x: 0, y: 0 },
    id: "angle",
    kind: "arc",
    radius: 2,
    startDegrees: 0,
    sweepDegrees,
  };
}

function quadratic(
  inputAxis: "x" | "y",
  coefficients = { a: 1, b: 0, c: 0 },
  domain = { max: 2, min: -2 }
): Extract<ResolvedPlaneObject, { readonly kind: "quadratic" }> {
  return {
    appearance: "primary",
    coefficients,
    domain,
    id: `quadratic-${inputAxis}`,
    inputAxis,
    kind: "quadratic",
  };
}

function formatQuadratic(curve: ReturnType<typeof resolvePlaneQuadratic>) {
  const point = (value: (typeof curve)["start"]) => ({
    x: BigDecimal.format(value.x),
    y: BigDecimal.format(value.y),
  });
  return {
    control: point(curve.control),
    end: point(curve.end),
    start: point(curve.start),
  };
}

function formatRange(range: ReturnType<typeof resolvePlaneViewport>["x"]) {
  return {
    max: BigDecimal.format(range.max),
    min: BigDecimal.format(range.min),
  };
}

describe("MathVisual plane projection", () => {
  it("uses the same screen scale for both mathematical axes", () => {
    const viewport = resolvePlaneViewport(
      scene({ max: 5, min: -1 }, { max: 7, min: -1 })
    );
    const origin = projectPlanePoint({ x: 0, y: 0 }, viewport);
    const xUnit = projectPlanePoint({ x: 1, y: 0 }, viewport);
    const yUnit = projectPlanePoint({ x: 0, y: 1 }, viewport);

    expect(xUnit.x - origin.x).toBeCloseTo(origin.y - yUnit.y, 12);
    expect(xUnit.x - origin.x).toBeCloseTo(projectPlaneRadius(1, viewport), 12);
  });

  it("preserves asymmetric frame coordinates inside one fitted view", () => {
    const viewport = resolvePlaneViewport(
      scene({ max: 8, min: -2 }, { max: 3, min: -1 })
    );
    const minimum = projectPlanePoint({ x: -2, y: -1 }, viewport);
    const maximum = projectPlanePoint({ x: 8, y: 3 }, viewport);

    expect(minimum.x).toBeLessThan(maximum.x);
    expect(minimum.y).toBeGreaterThan(maximum.y);
    expect(formatRange(viewport.x)).toEqual({ max: "8", min: "-2" });
  });

  it.each([
    [90, "0 0"],
    [-90, "0 1"],
    [270, "1 0"],
    [-270, "1 1"],
  ] as const)(
    "keeps the large-arc and directed-sweep flags for %s degrees",
    (sweepDegrees, flags) => {
      const viewport = resolvePlaneViewport(
        scene({ max: 4, min: -4 }, { max: 4, min: -4 })
      );

      expect(createPlaneArc(arc(sweepDegrees), viewport)).toContain(
        ` 0 ${flags} `
      );
    }
  );

  it("shares one projection for paths, labels, and object anchors", () => {
    const viewport = resolvePlaneViewport(
      scene({ max: 2, min: -2 }, { max: 2, min: -2 })
    );
    const point = { x: 1, y: -1 };
    const projected = projectPlanePoint(point, viewport);

    expect(createPlanePoints([point], viewport)).toBe(
      `${projected.x},${projected.y}`
    );
  });

  it.each([
    [
      "x",
      { a: 2, b: -3, c: 1 },
      { max: 2, min: -1 },
      {
        control: { x: "0.5", y: "-4.5" },
        end: { x: "2", y: "3" },
        start: { x: "-1", y: "6" },
      },
    ],
    [
      "y",
      { a: -1, b: 2, c: 3 },
      { max: 4, min: -2 },
      {
        control: { x: "13", y: "1" },
        end: { x: "-5", y: "4" },
        start: { x: "-5", y: "-2" },
      },
    ],
  ] as const)(
    "resolves exact endpoint and control coordinates for the %s input axis",
    (inputAxis, coefficients, domain, expected) => {
      expect(
        formatQuadratic(
          resolvePlaneQuadratic(quadratic(inputAxis, coefficients, domain))
        )
      ).toEqual(expected);
    }
  );

  it("keeps finite control points when coefficient products overflow Number", () => {
    const object = quadratic(
      "x",
      { a: 1e308, b: -1e308, c: -1e308 },
      { max: 2, min: 1 }
    );
    const curve = resolvePlaneQuadratic(object);

    expect(formatQuadratic(curve)).toEqual({
      control: { x: "1.5", y: "-5e+307" },
      end: { x: "2", y: "1e+308" },
      start: { x: "1", y: "-1e+308" },
    });
    expect(
      createPlaneQuadratic(object, {
        x: { max: BigDecimal.fromBigInt(2n), min: BigDecimal.fromBigInt(1n) },
        y: {
          max: BigDecimal.fromNumberUnsafe(1e308),
          min: BigDecimal.fromNumberUnsafe(-1e308),
        },
      })
    ).toBe("M 36 444 Q 360 342 684 36");
  });

  it.each([
    ["x", "M 36 444 Q 37 444 38 440"],
    ["y", "M 36 444 Q 36 443 40 442"],
  ] as const)(
    "serializes one exact %s-input quadratic command under the affine viewport",
    (inputAxis, path) => {
      const viewport = resolvePlaneViewport(
        scene({ max: 648, min: 0 }, { max: 408, min: 0 })
      );
      const object = quadratic(
        inputAxis,
        { a: 1, b: 0, c: 0 },
        { max: 2, min: 0 }
      );

      expect(createPlaneQuadratic(object, viewport)).toBe(path);
    }
  );

  it("creates stable decimal ticks over negative and positive ranges", () => {
    expect(createPlaneTicks({ max: 1.2, min: -0.3 })).toEqual([
      -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.2,
    ]);
  });

  it("projects the widest finite frame without overflow or unbounded ticks", () => {
    const visual = scene(
      { max: 1e308, min: -1e308 },
      { max: 1e308, min: -1e308 }
    );
    const viewport = resolvePlaneViewport(visual);
    const minimum = projectPlanePoint({ x: -1e308, y: -1e308 }, viewport);
    const maximum = projectPlanePoint({ x: 1e308, y: 1e308 }, viewport);
    const ticks = createPlaneTicks(visual.frame.x);

    expect(Object.values(minimum).every(Number.isFinite)).toBe(true);
    expect(Object.values(maximum).every(Number.isFinite)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(14);
    expect(ticks.every(Number.isFinite)).toBe(true);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("keeps a subnormal range finite and terminates when Number cannot advance", () => {
    const range = { max: Number.MIN_VALUE, min: 0 };
    const viewport = resolvePlaneViewport(scene(range, range));
    const maximum = projectPlanePoint(
      { x: Number.MIN_VALUE, y: Number.MIN_VALUE },
      viewport
    );
    const ticks = createPlaneTicks(range);

    expect(Object.values(maximum).every(Number.isFinite)).toBe(true);
    expect(projectPlaneRadius(Number.MIN_VALUE, viewport)).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(14);
    expect(new Set(ticks).size).toBe(ticks.length);
  });
});
