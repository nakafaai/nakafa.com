import { SpacePointSchema } from "@nakafa/aksara-contracts/math/base";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr, Option, Schema } from "effect";
import type { SpacePoint } from "@/lib/content/renderer/client/base/visual/scene";

export const AutoLabelBoxSchema = Schema.Struct({
  cx: Schema.Finite,
  cy: Schema.Finite,
  halfH: Schema.Finite,
  halfW: Schema.Finite,
});
export type AutoLabelBox = typeof AutoLabelBoxSchema.Type;

const RectBoundsSchema = Schema.Struct({
  maxX: Schema.Finite,
  maxY: Schema.Finite,
  minX: Schema.Finite,
  minY: Schema.Finite,
});
type RectBounds = typeof RectBoundsSchema.Type;

const CurveSegmentSchema = Schema.Tuple([SpacePointSchema, SpacePointSchema]);
export type CurveSegment = typeof CurveSegmentSchema.Type;

export const ZERO_TOLERANCE = 1e-6;
const FRAME_INSET = 0.14;

/** Insets a 2D coordinate frame by a uniform margin for interior anchor selection. */
export function insetBounds(box: CoordinateFrame): RectBounds {
  const padX = (box.x.max - box.x.min) * FRAME_INSET;
  const padY = (box.y.max - box.y.min) * FRAME_INSET;
  return {
    maxX: box.x.max - padX,
    maxY: box.y.max - padY,
    minX: box.x.min + padX,
    minY: box.y.min + padY,
  };
}

function narrowClipRange(
  range: readonly [number, number],
  p: number,
  q: number
): Option.Option<readonly [number, number]> {
  const [t0, t1] = range;
  if (Math.abs(p) < ZERO_TOLERANCE) {
    return q < 0 ? Option.none() : Option.some(range);
  }
  const r = q / p;
  if (p < 0) {
    return r > t1 ? Option.none() : Option.some([Math.max(t0, r), t1]);
  }
  return r < t0 ? Option.none() : Option.some([t0, Math.min(t1, r)]);
}

/** Liang-Barsky 2D segment-to-rectangle clip range in `[0, 1]`. */
export function clipSegmentRange(
  a: SpacePoint,
  b: SpacePoint,
  rect: RectBounds
): Option.Option<readonly [number, number]> {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, a.x - rect.minX],
    [dx, rect.maxX - a.x],
    [-dy, a.y - rect.minY],
    [dy, rect.maxY - a.y],
  ];
  return Arr.reduce(
    edges,
    Option.some<readonly [number, number]>([0, 1]),
    (range, [p, q]) =>
      Option.flatMap(range, (current) => narrowClipRange(current, p, q))
  );
}

/** Signed gap between two axis-aligned label boxes (negative when overlapping). */
export function boxGap(a: AutoLabelBox, b: AutoLabelBox): number {
  const dx = Math.abs(a.cx - b.cx) - (a.halfW + b.halfW);
  const dy = Math.abs(a.cy - b.cy) - (a.halfH + b.halfH);
  if (dx <= 0 && dy <= 0) {
    return Math.max(dx, dy);
  }
  return Math.hypot(Math.max(0, dx), Math.max(0, dy));
}

function pointToBoxDistance(point: SpacePoint, box: AutoLabelBox): number {
  const dx = Math.max(0, Math.abs(point.x - box.cx) - box.halfW);
  const dy = Math.max(0, Math.abs(point.y - box.cy) - box.halfH);
  return Math.hypot(dx, dy);
}

function pointToSegmentDistance(
  px: number,
  py: number,
  a: SpacePoint,
  b: SpacePoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < ZERO_TOLERANCE) {
    return Math.hypot(px - a.x, py - a.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq)
  );
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

/** Exact Euclidean distance between a 2D line segment and an axis-aligned label box. */
export function segmentToBoxDistance(
  [a, b]: CurveSegment,
  box: AutoLabelBox
): number {
  const rect: RectBounds = {
    maxX: box.cx + box.halfW,
    maxY: box.cy + box.halfH,
    minX: box.cx - box.halfW,
    minY: box.cy - box.halfH,
  };
  if (Option.isSome(clipSegmentRange(a, b, rect))) {
    return 0;
  }
  return Math.min(
    pointToBoxDistance(a, box),
    pointToBoxDistance(b, box),
    pointToSegmentDistance(rect.minX, rect.minY, a, b),
    pointToSegmentDistance(rect.maxX, rect.minY, a, b),
    pointToSegmentDistance(rect.minX, rect.maxY, a, b),
    pointToSegmentDistance(rect.maxX, rect.maxY, a, b)
  );
}

/** Minimum Euclidean distance from a box to any segment in a collection. */
export function minSegmentDistance(
  segments: readonly CurveSegment[],
  box: AutoLabelBox,
  fallback: number
): number {
  if (segments.length === 0) {
    return fallback;
  }
  return Math.min(
    ...Arr.map(segments, (segment) => segmentToBoxDistance(segment, box))
  );
}

/** Minimum distance from a label box to either coordinate axis through `origin`. */
export function boxAxisDistance(box: AutoLabelBox, origin: SpacePoint): number {
  const dx = Math.max(0, Math.abs(origin.x - box.cx) - box.halfW);
  const dy = Math.max(0, Math.abs(origin.y - box.cy) - box.halfH);
  return Math.min(dx, dy);
}

/** Minimum signed margin between a label box and the frame edges (negative if clipped). */
export function boxEdgeMargin(
  box: AutoLabelBox,
  focus: CoordinateFrame
): number {
  return Math.min(
    box.cx - box.halfW - focus.x.min,
    focus.x.max - (box.cx + box.halfW),
    box.cy - box.halfH - focus.y.min,
    focus.y.max - (box.cy + box.halfH)
  );
}
