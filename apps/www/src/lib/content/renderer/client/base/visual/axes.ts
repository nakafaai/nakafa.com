import { Array as Arr } from "effect";
import type {
  PlaneVisual,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import type { VisualProjection } from "@/lib/content/renderer/client/base/visual/transform";
import {
  projectVisualFrame,
  projectVisualPoint,
} from "@/lib/content/renderer/client/base/visual/transform";

/** The authored range of each axis a scene draws, in the order its axes are drawn. */
function axisRanges(scene: PlaneVisual | SpaceVisual) {
  return scene.space === "plane"
    ? ([
        ["x", scene.frame.x],
        ["y", scene.frame.y],
      ] as const)
    : ([
        ["x", scene.frame.x],
        ["y", scene.frame.y],
        ["z", scene.frame.z],
      ] as const);
}

/**
 * The axes of a scene, which the interactive scene and its still both draw, in
 * GPU units. They span the scene's own frame and never reach past it, so a
 * frame far from zero, such as y from 35 to 39, fills the picture instead of
 * shrinking to keep zero in sight. They cross at the origin when the frame
 * holds it, and otherwise at the frame's nearest edge (`anchor`), where the
 * grid stands too. An axis whose range leaves zero out names its real values
 * at its two ends (`values`), so an axis at the edge never reads as one
 * through zero.
 */
export function resolveVisualAxes(
  scene: PlaneVisual | SpaceVisual,
  projection: VisualProjection
) {
  const frame = projectVisualFrame(scene, projection);
  const origin = projectVisualPoint({ x: 0, y: 0, z: 0 }, projection);
  const clamp = (axis: "x" | "y" | "z") =>
    Math.min(frame[axis].max, Math.max(frame[axis].min, origin[axis]));
  const anchor = { x: clamp("x"), y: clamp("y"), z: clamp("z") };
  const ranges = axisRanges(scene);
  return {
    anchor,
    frame,
    lines: Arr.map(ranges, ([axis]) => ({
      axis,
      from: { ...anchor, [axis]: frame[axis].min },
      to: { ...anchor, [axis]: frame[axis].max },
    })),
    values: Arr.flatMap(ranges, ([axis, range]) =>
      range.min <= 0 && range.max >= 0
        ? []
        : [
            {
              at: { ...anchor, [axis]: frame[axis].min },
              axis,
              end: "min" as const,
              value: range.min,
            },
            {
              at: { ...anchor, [axis]: frame[axis].max },
              axis,
              end: "max" as const,
              value: range.max,
            },
          ]
    ),
  };
}
