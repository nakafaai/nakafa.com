import {
  createCircleArcPoints,
  createCircleOutlinePoints,
} from "@repo/design-system/components/contents/mathematics/circle";
import { getCurveDivisions } from "@repo/design-system/components/three/data/quality";
import { Array as Arr, BigDecimal } from "effect";
import type { PlaneObject } from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectExactPlanePoint,
  projectVisualMeasure,
  projectVisualPoint,
  type VisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

const TWO = BigDecimal.fromBigInt(2n);
function evaluateQuadratic(
  object: Extract<PlaneObject, { readonly kind: "quadratic" }>,
  input: BigDecimal.BigDecimal
) {
  const { a, b, c } = object.coefficients;
  return BigDecimal.sum(
    BigDecimal.multiply(
      BigDecimal.sum(
        BigDecimal.multiply(BigDecimal.fromNumberUnsafe(a), input),
        BigDecimal.fromNumberUnsafe(b)
      ),
      input
    ),
    BigDecimal.fromNumberUnsafe(c)
  );
}

/** Resolves one authored quadratic into exact decimal Bernstein control points. */
export function resolvePlaneQuadratic(
  object: Extract<PlaneObject, { readonly kind: "quadratic" }>
) {
  const startInput = BigDecimal.fromNumberUnsafe(object.domain.min);
  const endInput = BigDecimal.fromNumberUnsafe(object.domain.max);
  const halfSpan = BigDecimal.divideUnsafe(
    BigDecimal.subtract(endInput, startInput),
    TWO
  );
  const controlInput = BigDecimal.sum(startInput, halfSpan);
  const startOutput = evaluateQuadratic(object, startInput);
  const endOutput = evaluateQuadratic(object, endInput);
  const derivative = BigDecimal.sum(
    BigDecimal.multiplyAll([
      TWO,
      BigDecimal.fromNumberUnsafe(object.coefficients.a),
      startInput,
    ]),
    BigDecimal.fromNumberUnsafe(object.coefficients.b)
  );
  const controlOutput = BigDecimal.sum(
    startOutput,
    BigDecimal.multiply(derivative, halfSpan)
  );
  const point = (
    input: BigDecimal.BigDecimal,
    output: BigDecimal.BigDecimal
  ) =>
    object.inputAxis === "x"
      ? { x: input, y: output }
      : { x: output, y: input };

  return {
    control: point(controlInput, controlOutput),
    end: point(endInput, endOutput),
    start: point(startInput, startOutput),
  };
}

/** Samples analytic geometry in normalized units without spline distortion. */
export function resolvePlaneCurve(
  object: Extract<
    PlaneObject,
    { readonly kind: "arc" | "circle" | "quadratic" }
  >,
  projection: VisualProjection
) {
  if (object.kind !== "quadratic") {
    const center = projectVisualPoint(object.center, projection);
    const radius = projectVisualMeasure(object.radius, projection);
    const points =
      object.kind === "circle"
        ? createCircleOutlinePoints(radius)
        : createCircleArcPoints({
            radius,
            startDegrees: object.startDegrees,
            sweepDegrees: object.sweepDegrees,
          });
    return Arr.map(points, (point) => ({
      x: center.x + point.x,
      y: center.y + point.y,
      z: 0,
    }));
  }
  const curve = resolvePlaneQuadratic(object);
  const start = projectExactPlanePoint(curve.start, projection);
  const control = projectExactPlanePoint(curve.control, projection);
  const end = projectExactPlanePoint(curve.end, projection);
  const divisions = getCurveDivisions(3);
  return Array.from({ length: divisions + 1 }, (_, index) => {
    const t = index / divisions;
    const u = 1 - t;
    return {
      x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      z: 0,
    };
  });
}
