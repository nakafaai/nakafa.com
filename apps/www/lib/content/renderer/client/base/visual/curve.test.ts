import { describe, expect, it } from "@effect/vitest";
import { BigDecimal } from "effect";
import {
  resolvePlaneCurve,
  resolvePlaneQuadratic,
} from "@/lib/content/renderer/client/base/visual/curve";
import type {
  PlaneObject,
  PlaneVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import { resolveVisualProjection } from "@/lib/content/renderer/client/base/visual/transform";

function projection(x = { min: -5, max: 5 }, y = x) {
  return resolveVisualProjection({
    space: "plane",
    frame: { kind: "cartesian", x, y },
    view: { kind: "fit" },
    objects: [
      {
        kind: "point",
        id: "origin",
        appearance: "primary",
        at: { x: 0, y: 0 },
      },
    ],
  } satisfies PlaneVisual);
}
function quadratic(
  inputAxis: "x" | "y",
  coefficients = { a: 1, b: 0, c: 0 },
  domain = { max: 2, min: -2 }
): Extract<PlaneObject, { readonly kind: "quadratic" }> {
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

describe("MathVisual analytic curves", () => {
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

  it("normalizes before sampling even when coefficient products overflow Number", () => {
    const object = quadratic(
      "x",
      { a: 1e308, b: -1e308, c: -1e308 },
      { min: 1, max: 2 }
    );
    expect(formatQuadratic(resolvePlaneQuadratic(object))).toEqual({
      control: { x: "1.5", y: "-5e+307" },
      end: { x: "2", y: "1e+308" },
      start: { x: "1", y: "-1e+308" },
    });
    const points = resolvePlaneCurve(
      object,
      projection({ min: 1, max: 2 }, { min: -1e308, max: 1e308 })
    );
    expect(
      points.flatMap(({ x, y, z }) => [x, y, z]).every(Number.isFinite)
    ).toBe(true);
    expect(points[0].y).toBe(-5);
    expect(points.at(-1)?.y).toBe(5);
    expect(points[32].y).toBe(-1.25);
  });
  it.each(["x", "y"] as const)(
    "samples every point on the %s-input quadratic",
    (inputAxis) => {
      const points = resolvePlaneCurve(quadratic(inputAxis), projection());
      for (const point of points) {
        const input = point[inputAxis];
        const output = point[inputAxis === "x" ? "y" : "x"];
        expect(output).toBeCloseTo(input ** 2, 12);
      }
    }
  );
  it.each([90, -90, 270, -270])(
    "preserves the full directed sweep for %s degrees",
    (sweepDegrees) => {
      const points = resolvePlaneCurve(
        {
          appearance: "primary",
          center: { x: 1, y: -1 },
          id: "angle",
          kind: "arc",
          radius: 2,
          startDegrees: 0,
          sweepDegrees,
        },
        projection()
      );
      expect(points[0]).toEqual({ x: 3, y: -1, z: 0 });
      for (const [index, point] of points.entries()) {
        const angle =
          ((index / (points.length - 1)) * sweepDegrees * Math.PI) / 180;
        expect(point.x).toBeCloseTo(1 + 2 * Math.cos(angle), 12);
        expect(point.y).toBeCloseTo(-1 + 2 * Math.sin(angle), 12);
      }
    }
  );
  it("closes a circle exactly and preserves its center and radius", () => {
    const points = resolvePlaneCurve(
      {
        appearance: "primary",
        center: { x: 1, y: -1 },
        id: "circle",
        kind: "circle",
        radius: 2,
      },
      projection()
    );
    expect(points[0]).toEqual(points.at(-1));
    for (const point of points) {
      expect(Math.hypot(point.x - 1, point.y + 1)).toBeCloseTo(2, 12);
    }
  });
});
