import { BigDecimal } from "effect";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import type { VisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import {
  projectVisualFrame,
  projectVisualPoint,
  WORLD_EXTENT,
  worldScale,
} from "@/lib/content/renderer/client/base/visual/transform";

/**
 * How far the world reaches from the frame's center, in multiples of the
 * world extent its longest padded span maps onto. The camera zooms out to two
 * thirds of its first view at most and pans only within what it fitted, so
 * even a full-screen view at 21:9 sees under a third of this; past it the
 * axes, the grid and unbounded objects end, out of sight.
 */
const REACH = 3;

/**
 * The world of one scene: the region its first view frames (`focus`, the
 * padded frame), the true origin and the world units each authored unit takes
 * (`scale`), and the box an unbounded object is drawn to (`box`, in authored
 * units), whose half-width in world units is `radius`. The frame is only where
 * the camera starts: the grid, the axes and every line, ray, region and
 * implicit curve continue past it to the reach.
 */
export function resolveVisualReach(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection
) {
  const reach = BigDecimal.fromBigInt(BigInt(REACH));
  // A frame near the largest number reaches past it; the reach then stops at the largest finite number.
  const finite = (value: BigDecimal.BigDecimal) =>
    Math.min(
      Number.MAX_VALUE,
      Math.max(-Number.MAX_VALUE, BigDecimal.toNumberUnsafe(value))
    );
  const range = (axis: "x" | "y" | "z") => {
    const half = BigDecimal.multiply(projection.extent[axis], reach);
    return {
      max: finite(BigDecimal.sum(projection.center[axis], half)),
      min: finite(BigDecimal.subtract(projection.center[axis], half)),
    };
  };
  return {
    box: { x: range("x"), y: range("y"), z: range("z") },
    focus: projectVisualFrame(scene, projection, true),
    origin: projectVisualPoint({ x: 0, y: 0, z: 0 }, projection),
    radius: BigDecimal.toNumberUnsafe(BigDecimal.multiply(WORLD_EXTENT, reach)),
    scale: worldScale(projection),
  };
}
