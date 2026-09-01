import { BigDecimal } from "effect";

import type { ResolvedPlaneObject } from "@/lib/content/renderer/client/base/visual/geometry";
import type {
  PlanePoint,
  PlaneVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

export const PLANE_WIDTH = 720;
export const PLANE_HEIGHT = 480;
export const PLANE_MARGIN = 36;

const GRID_DIVISIONS = 12;
const MAXIMUM_TICKS = GRID_DIVISIONS + 2;
const TWO = BigDecimal.fromBigInt(2n);

interface ExactRange {
  readonly max: BigDecimal.BigDecimal;
  readonly min: BigDecimal.BigDecimal;
}

export interface PlaneViewport {
  readonly x: ExactRange;
  readonly y: ExactRange;
}

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function span(range: ExactRange) {
  return BigDecimal.subtract(range.max, range.min);
}

function paddedRange(
  range: PlaneVisual["frame"]["x"],
  padding: BigDecimal.BigDecimal
): ExactRange {
  return {
    max: BigDecimal.sum(decimal(range.max), padding),
    min: BigDecimal.subtract(decimal(range.min), padding),
  };
}

function extendRange(range: ExactRange, extension: BigDecimal.BigDecimal) {
  return {
    max: BigDecimal.sum(range.max, extension),
    min: BigDecimal.subtract(range.min, extension),
  };
}

/** Fits an authored frame into the fixed view box without changing its scale. */
export function resolvePlaneViewport(scene: PlaneVisual): PlaneViewport {
  const padding = decimal(scene.view.padding ?? 0);
  let x = paddedRange(scene.frame.x, padding);
  let y = paddedRange(scene.frame.y, padding);
  const width = decimal(PLANE_WIDTH - 2 * PLANE_MARGIN);
  const height = decimal(PLANE_HEIGHT - 2 * PLANE_MARGIN);
  const xSpan = span(x);
  const ySpan = span(y);

  if (
    BigDecimal.isLessThan(
      BigDecimal.multiply(xSpan, height),
      BigDecimal.multiply(ySpan, width)
    )
  ) {
    const targetSpan = BigDecimal.divideUnsafe(
      BigDecimal.multiply(ySpan, width),
      height
    );
    x = extendRange(
      x,
      BigDecimal.divideUnsafe(BigDecimal.subtract(targetSpan, xSpan), TWO)
    );
  } else {
    const targetSpan = BigDecimal.divideUnsafe(
      BigDecimal.multiply(xSpan, height),
      width
    );
    y = extendRange(
      y,
      BigDecimal.divideUnsafe(BigDecimal.subtract(targetSpan, ySpan), TWO)
    );
  }

  return { x, y };
}

export function projectExactPlanePoint(
  point: {
    readonly x: BigDecimal.BigDecimal;
    readonly y: BigDecimal.BigDecimal;
  },
  viewport: PlaneViewport
) {
  const xRatio = BigDecimal.divideUnsafe(
    BigDecimal.subtract(point.x, viewport.x.min),
    span(viewport.x)
  );
  const yRatio = BigDecimal.divideUnsafe(
    BigDecimal.subtract(viewport.y.max, point.y),
    span(viewport.y)
  );
  const offset = decimal(PLANE_MARGIN);

  return {
    x: BigDecimal.sum(
      offset,
      BigDecimal.multiply(xRatio, decimal(PLANE_WIDTH - 2 * PLANE_MARGIN))
    ),
    y: BigDecimal.sum(
      offset,
      BigDecimal.multiply(yRatio, decimal(PLANE_HEIGHT - 2 * PLANE_MARGIN))
    ),
  };
}

/** Projects one mathematical point into the shared SVG and label coordinates. */
export function projectPlanePoint(point: PlanePoint, viewport: PlaneViewport) {
  const projected = projectExactPlanePoint(
    { x: decimal(point.x), y: decimal(point.y) },
    viewport
  );
  return {
    x: BigDecimal.toNumberUnsafe(projected.x),
    y: BigDecimal.toNumberUnsafe(projected.y),
  };
}

/** Projects one mathematical radius with the viewport's common axis scale. */
export function projectPlaneRadius(radius: number, viewport: PlaneViewport) {
  return BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(
      BigDecimal.multiply(
        decimal(radius),
        decimal(PLANE_WIDTH - 2 * PLANE_MARGIN)
      ),
      span(viewport.x)
    )
  );
}

function tickStep(rangeSpan: BigDecimal.BigDecimal) {
  const rough = BigDecimal.divideUnsafe(
    rangeSpan,
    BigDecimal.fromBigInt(BigInt(GRID_DIVISIONS))
  );
  const normalized = BigDecimal.normalize(rough);
  const digits = (
    normalized.value < 0n ? -normalized.value : normalized.value
  ).toString().length;
  const exponent = digits - normalized.scale - 1;
  const magnitude = BigDecimal.make(1n, -exponent);
  const ratio = BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(rough, magnitude)
  );
  const factor = [1, 2, 5, 10].find((value) => ratio <= value) ?? 10;
  return BigDecimal.multiply(magnitude, BigDecimal.fromBigInt(BigInt(factor)));
}

/** Creates readable decimal ticks with an absolute iteration bound. */
export function createPlaneTicks(range: PlaneVisual["frame"]["x"]) {
  const exact = { max: decimal(range.max), min: decimal(range.min) };
  const step = tickStep(span(exact));
  const first = BigDecimal.multiply(
    BigDecimal.ceil(BigDecimal.divideUnsafe(exact.min, step)),
    step
  );
  const ticks: number[] = [];

  for (let index = 0; index < MAXIMUM_TICKS; index += 1) {
    const value = BigDecimal.sum(
      first,
      BigDecimal.multiply(step, BigDecimal.fromBigInt(BigInt(index)))
    );
    if (BigDecimal.isGreaterThan(value, exact.max)) {
      break;
    }
    const numeric = BigDecimal.toNumberUnsafe(value);
    if (Number.isFinite(numeric) && ticks.at(-1) !== numeric) {
      ticks.push(numeric);
    }
  }

  return ticks;
}

/** Serializes exact projected points for an SVG polyline. */
export function createPlanePoints(
  points: readonly PlanePoint[],
  viewport: PlaneViewport
) {
  return points
    .map((point) => {
      const projected = projectPlanePoint(point, viewport);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

function evaluateQuadratic(
  object: Extract<ResolvedPlaneObject, { readonly kind: "quadratic" }>,
  input: BigDecimal.BigDecimal
) {
  const { a, b, c } = object.coefficients;
  return BigDecimal.sum(
    BigDecimal.multiply(
      BigDecimal.sum(BigDecimal.multiply(decimal(a), input), decimal(b)),
      input
    ),
    decimal(c)
  );
}

/** Resolves one authored quadratic into exact decimal Bernstein control points. */
export function resolvePlaneQuadratic(
  object: Extract<ResolvedPlaneObject, { readonly kind: "quadratic" }>
) {
  const startInput = decimal(object.domain.min);
  const endInput = decimal(object.domain.max);
  const halfSpan = BigDecimal.divideUnsafe(
    BigDecimal.subtract(endInput, startInput),
    TWO
  );
  const controlInput = BigDecimal.sum(startInput, halfSpan);
  const startOutput = evaluateQuadratic(object, startInput);
  const endOutput = evaluateQuadratic(object, endInput);
  const derivative = BigDecimal.sum(
    BigDecimal.multiplyAll([TWO, decimal(object.coefficients.a), startInput]),
    decimal(object.coefficients.b)
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

function coordinate(value: BigDecimal.BigDecimal) {
  const numeric = BigDecimal.toNumberUnsafe(value);
  return Number.isFinite(numeric) ? `${numeric}` : BigDecimal.format(value);
}

/** Serializes one exact quadratic Bezier after the shared affine projection. */
export function createPlaneQuadratic(
  object: Extract<ResolvedPlaneObject, { readonly kind: "quadratic" }>,
  viewport: PlaneViewport
) {
  const curve = resolvePlaneQuadratic(object);
  const start = projectExactPlanePoint(curve.start, viewport);
  const control = projectExactPlanePoint(curve.control, viewport);
  const end = projectExactPlanePoint(curve.end, viewport);
  return `M ${coordinate(start.x)} ${coordinate(start.y)} Q ${coordinate(control.x)} ${coordinate(control.y)} ${coordinate(end.x)} ${coordinate(end.y)}`;
}
