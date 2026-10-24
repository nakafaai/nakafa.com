import type { Interval } from "@repo/design-system/components/contents/mathematics/interval";
import { Schema } from "effect";

/** The bounds of one number-line segment, where an infinite bound is a ray to the axis edge. */
/**
 * One bound, which is finite or infinite: a missing bound is infinite, so no finite
 * Schema describes it. The guard names the JavaScript number type, and the bounds
 * never come from JSON, so no decoded input can reach this shape.
 */
const BoundSchema = Schema.declare(
  (value: unknown): value is number => typeof value === "number"
);
const SegmentBoundsSchema = Schema.Struct({
  end: BoundSchema,
  start: BoundSchema,
});
export type SegmentBounds = typeof SegmentBoundsSchema.Type;

/**
 * Reads the bounds of one number-line segment. A missing bound is infinite, so an
 * authored segment without a start or an end draws a ray to the edge of the axis.
 */
export function segmentBounds(segment: {
  readonly end?: number | undefined;
  readonly start?: number | undefined;
}): SegmentBounds {
  return {
    end: segment.end ?? Number.POSITIVE_INFINITY,
    start: segment.start ?? Number.NEGATIVE_INFINITY,
  };
}

/** The end-cap shape of one segment: a ray is open on its infinite side. */
type SegmentEdge = "bothInfinity" | "endInfinity" | "finite" | "startInfinity";

/** Selects the end-cap shape of one segment from its infinite bounds. */
export function segmentEdge({ end, start }: SegmentBounds): SegmentEdge {
  const isStartInfinity = start === Number.NEGATIVE_INFINITY;
  const isEndInfinity = end === Number.POSITIVE_INFINITY;

  if (isStartInfinity && isEndInfinity) {
    return "bothInfinity";
  }
  if (isStartInfinity) {
    return "startInfinity";
  }
  if (isEndInfinity) {
    return "endInfinity";
  }
  return "finite";
}

/**
 * The horizontal position of one value on the drawn scale, in percent of its width.
 * An infinite bound sits on the edge of the axis it runs toward.
 */
export function positionOf(value: number, scale: Interval): number {
  if (value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 100;
  }
  return ((value - scale.min) / (scale.max - scale.min)) * 100;
}
