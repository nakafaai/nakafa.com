import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { BigDecimal } from "effect";

import type {
  PlanePoint,
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

const WORLD_EXTENT = BigDecimal.fromBigInt(10n);
const TWO = BigDecimal.fromBigInt(2n);
const ZERO = BigDecimal.fromBigInt(0n);
interface ExactRange {
  readonly max: BigDecimal.BigDecimal;
  readonly min: BigDecimal.BigDecimal;
}
export interface VisualProjection {
  readonly center: {
    readonly x: BigDecimal.BigDecimal;
    readonly y: BigDecimal.BigDecimal;
    readonly z: BigDecimal.BigDecimal;
  };
  readonly extent: BigDecimal.BigDecimal;
}
function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}
function range(
  bounds: { readonly min: number; readonly max: number },
  padding: number
): ExactRange {
  return {
    min: BigDecimal.subtract(decimal(bounds.min), decimal(padding)),
    max: BigDecimal.sum(decimal(bounds.max), decimal(padding)),
  };
}
function include(bounds: ExactRange, value: number): ExactRange {
  return {
    min: BigDecimal.min(bounds.min, decimal(value)),
    max: BigDecimal.max(bounds.max, decimal(value)),
  };
}
function midpoint(bounds: ExactRange) {
  return BigDecimal.divideUnsafe(BigDecimal.sum(bounds.min, bounds.max), TWO);
}
function span(bounds: ExactRange) {
  return BigDecimal.subtract(bounds.max, bounds.min);
}
function frameRanges(scene: PlaneVisual | SpaceVisual, padded: boolean) {
  const padding =
    padded && scene.view.kind === "fit" ? (scene.view.padding ?? 0) : 0;
  return {
    x: range(scene.frame.x, padding),
    y: range(scene.frame.y, padding),
    z:
      scene.space === "plane"
        ? { min: ZERO, max: ZERO }
        : range(scene.frame.z, padding),
  };
}
/** Uses one exact uniform scale before converting authored values to GPU units. */
export function resolveVisualProjection(
  scene: PlaneVisual | SpaceVisual
): VisualProjection {
  let { x, y, z } = frameRanges(scene, true);
  let points: readonly SpacePoint[] = [];
  if (scene.view.kind === "camera") {
    points = [scene.view.position, scene.view.target];
  } else if (scene.view.kind === "isometric" && scene.view.target) {
    points = [scene.view.target];
  }
  for (const point of points) {
    x = include(x, point.x);
    y = include(y, point.y);
    z = include(z, point.z);
  }
  return {
    center: { x: midpoint(x), y: midpoint(y), z: midpoint(z) },
    extent: BigDecimal.max(span(x), BigDecimal.max(span(y), span(z))),
  };
}
function coordinate(
  value: BigDecimal.BigDecimal,
  center: BigDecimal.BigDecimal,
  extent: BigDecimal.BigDecimal
) {
  return BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(
      BigDecimal.multiply(BigDecimal.subtract(value, center), WORLD_EXTENT),
      extent
    )
  );
}
/** Projects plane points into z=0 and spatial points through the same map. */
export function projectVisualPoint(
  point: PlanePoint | SpacePoint,
  projection: VisualProjection
): SpacePoint {
  return {
    x: coordinate(decimal(point.x), projection.center.x, projection.extent),
    y: coordinate(decimal(point.y), projection.center.y, projection.extent),
    z: coordinate(
      "z" in point ? decimal(point.z) : ZERO,
      projection.center.z,
      projection.extent
    ),
  };
}
/** Keeps quadratic control points exact until after normalization. */
export function projectExactPlanePoint(
  point: {
    readonly x: BigDecimal.BigDecimal;
    readonly y: BigDecimal.BigDecimal;
  },
  projection: VisualProjection
): SpacePoint {
  return {
    x: coordinate(point.x, projection.center.x, projection.extent),
    y: coordinate(point.y, projection.center.y, projection.extent),
    z: 0,
  };
}
/** Scales an authored length without overflowing an intermediate product. */
export function projectVisualMeasure(
  measure: number,
  projection: VisualProjection
) {
  return BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(
      BigDecimal.multiply(decimal(measure), WORLD_EXTENT),
      projection.extent
    )
  );
}
/** Preserves authored frame proportions and optional camera padding. */
export function projectVisualFrame(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection,
  padded = false
): CoordinateFrame {
  const bounds = frameRanges(scene, padded);
  const project = (axis: "x" | "y" | "z") => ({
    min: coordinate(
      bounds[axis].min,
      projection.center[axis],
      projection.extent
    ),
    max: coordinate(
      bounds[axis].max,
      projection.center[axis],
      projection.extent
    ),
  });
  return { x: project("x"), y: project("y"), z: project("z") };
}
