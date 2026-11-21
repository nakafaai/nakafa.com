import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr, BigDecimal } from "effect";

import type {
  PlanePoint,
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

/** The world units the longest padded span of a frame maps onto. */
export const WORLD_EXTENT = BigDecimal.fromBigInt(10n);
const TWO = BigDecimal.fromBigInt(2n);
const ZERO = BigDecimal.fromBigInt(0n);
type ExactRange = ReturnType<typeof range>;
export type VisualProjection = ReturnType<typeof resolveVisualProjection>;
function range(
  bounds: { readonly min: number; readonly max: number },
  padding: BigDecimal.BigDecimal
) {
  return {
    min: BigDecimal.subtract(BigDecimal.fromNumberUnsafe(bounds.min), padding),
    max: BigDecimal.sum(BigDecimal.fromNumberUnsafe(bounds.max), padding),
  };
}
function include(bounds: ExactRange, value: number): ExactRange {
  return {
    min: BigDecimal.min(bounds.min, BigDecimal.fromNumberUnsafe(value)),
    max: BigDecimal.max(bounds.max, BigDecimal.fromNumberUnsafe(value)),
  };
}
function midpoint(bounds: ExactRange) {
  return BigDecimal.divideUnsafe(BigDecimal.sum(bounds.min, bounds.max), TWO);
}
function span(bounds: ExactRange) {
  return BigDecimal.subtract(bounds.max, bounds.min);
}
function frameRanges(scene: PlaneVisual | SpaceVisual, padded: boolean) {
  const raw = {
    x: range(scene.frame.x, ZERO),
    y: range(scene.frame.y, ZERO),
    z:
      scene.space === "plane"
        ? { min: ZERO, max: ZERO }
        : range(scene.frame.z, ZERO),
  };
  const padding =
    padded && scene.view.kind === "fit" ? (scene.view.padding ?? 0) : 0;
  if (padding === 0) {
    return raw;
  }
  const amount = BigDecimal.fromNumberUnsafe(padding);
  const spans = { x: span(raw.x), y: span(raw.y), z: span(raw.z) };
  const extents = axisExtents(scene, spans);
  const longest = BigDecimal.max(
    extents.x,
    BigDecimal.max(extents.y, extents.z)
  );
  // On a graph with independent X and Y scales, scale padding proportionally
  // to each axis's extent so a narrow axis (e.g. seconds [0, 0.8] paired with
  // pressure [0, 16]) is never bloated by raw padding written for the wider axis.
  const padAxis = (extent: BigDecimal.BigDecimal) =>
    BigDecimal.equals(extent, longest)
      ? amount
      : BigDecimal.divideUnsafe(BigDecimal.multiply(amount, extent), longest);
  return {
    x: range(scene.frame.x, padAxis(extents.x)),
    y: range(scene.frame.y, padAxis(extents.y)),
    z:
      scene.space === "plane"
        ? { min: ZERO, max: ZERO }
        : range(scene.frame.z, padAxis(extents.z)),
  };
}
/**
 * The aspects, wide over tall, between which a graph draws its box: the
 * card's wide aspect (`threeSceneFrameVariants`) at the widest, and a square
 * at the tallest, which a phone's square card fills. A graph whose frame is
 * longer either way than these still fills the card instead of collapsing to
 * a flat line or a spike.
 */
const GRAPH_WIDEST = BigDecimal.fromNumberUnsafe(1.43);
const GRAPH_TALLEST = BigDecimal.fromBigInt(1n);
/**
 * The plane objects whose meaning is their shape: a circle is round, an arc's
 * angle is true, a polygon's sides keep their proportion, and a vector or a
 * ray points the way it is drawn. A parametric curve counts, because the
 * corpus draws circles and angle marks with it.
 */
const FIGURE_KINDS = [
  "arc",
  "circle",
  "implicit",
  "parametric",
  "polar",
  "polygon",
  "ray",
  "vector",
] as const satisfies readonly PlaneVisual["objects"][number]["kind"][];
/**
 * A space scene and a plane figure keep one scale on every axis, so nothing
 * they draw is distorted. Any other plane scene is a graph, which reads its
 * values from its axes as a chart does.
 */
function keepsShape(scene: PlaneVisual | SpaceVisual) {
  if (scene.space === "space") {
    return true;
  }
  return Arr.some(scene.objects, (object) =>
    Arr.contains(FIGURE_KINDS, object.kind)
  );
}
/**
 * The span of each axis that maps onto the world's extent. One scale takes
 * the longest span on every axis. A graph whose frame is wider than
 * `GRAPH_WIDEST` or taller than `GRAPH_TALLEST` gives one axis a scale of its
 * own, so its box is drawn at that aspect and its curve keeps its rise.
 */
function axisExtents(
  scene: PlaneVisual | SpaceVisual,
  spans: {
    readonly x: BigDecimal.BigDecimal;
    readonly y: BigDecimal.BigDecimal;
    readonly z: BigDecimal.BigDecimal;
  }
) {
  const longest = BigDecimal.max(spans.x, BigDecimal.max(spans.y, spans.z));
  const uniform = { x: longest, y: longest, z: longest };
  if (keepsShape(scene)) {
    return uniform;
  }
  const widest = BigDecimal.multiply(spans.y, GRAPH_WIDEST);
  if (BigDecimal.isGreaterThan(spans.x, widest)) {
    return { x: spans.x, y: widest, z: spans.x };
  }
  if (
    BigDecimal.isLessThan(spans.x, BigDecimal.multiply(spans.y, GRAPH_TALLEST))
  ) {
    return {
      x: BigDecimal.divideUnsafe(spans.x, GRAPH_TALLEST),
      y: spans.y,
      z: spans.y,
    };
  }
  return uniform;
}
/**
 * Maps authored values to GPU units exactly: the frame's center to the
 * world's origin, and each axis's extent to the world's extent.
 */
export function resolveVisualProjection(scene: PlaneVisual | SpaceVisual) {
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
    extent: axisExtents(scene, { x: span(x), y: span(y), z: span(z) }),
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
    x: coordinate(
      BigDecimal.fromNumberUnsafe(point.x),
      projection.center.x,
      projection.extent.x
    ),
    y: coordinate(
      BigDecimal.fromNumberUnsafe(point.y),
      projection.center.y,
      projection.extent.y
    ),
    z: coordinate(
      "z" in point ? BigDecimal.fromNumberUnsafe(point.z) : ZERO,
      projection.center.z,
      projection.extent.z
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
    x: coordinate(point.x, projection.center.x, projection.extent.x),
    y: coordinate(point.y, projection.center.y, projection.extent.y),
    z: 0,
  };
}
/** Projects the authored frame, with the camera's padding when asked. */
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
      projection.extent[axis]
    ),
    max: coordinate(
      bounds[axis].max,
      projection.center[axis],
      projection.extent[axis]
    ),
  });
  return { x: project("x"), y: project("y"), z: project("z") };
}
/** The world units one authored unit takes on each axis. */
export function worldScale(projection: VisualProjection) {
  const world = BigDecimal.toNumberUnsafe(WORLD_EXTENT);
  return {
    x: world / BigDecimal.toNumberUnsafe(projection.extent.x),
    y: world / BigDecimal.toNumberUnsafe(projection.extent.y),
    z: world / BigDecimal.toNumberUnsafe(projection.extent.z),
  };
}

/**
 * Projects sampled points through the same map in plain numbers. A formula
 * draws thousands of samples, so this reads the exact center and scale once
 * and leaves exact decimals to the authored coordinates.
 */
export function sampleProjector(projection: VisualProjection) {
  const scale = worldScale(projection);
  const center = {
    x: BigDecimal.toNumberUnsafe(projection.center.x),
    y: BigDecimal.toNumberUnsafe(projection.center.y),
    z: BigDecimal.toNumberUnsafe(projection.center.z),
  };
  return (point: SpacePoint): SpacePoint => ({
    x: (point.x - center.x) * scale.x,
    y: (point.y - center.y) * scale.y,
    z: (point.z - center.z) * scale.z,
  });
}
