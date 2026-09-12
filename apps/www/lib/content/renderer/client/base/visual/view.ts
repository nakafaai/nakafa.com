import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import type {
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualFrame,
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

function tuple({ x, y, z }: SpacePoint): [number, number, number] {
  return [x, y, z];
}
/** Authored direction is separate from the shared camera's measured framing. */
export function resolveMathView(
  scene: PlaneVisual | SpaceVisual,
  projection = resolveVisualProjection(scene)
): {
  readonly position: [number, number, number];
  readonly target: [number, number, number];
  readonly projection: CameraProjection;
} {
  const bounds = projectVisualFrame(scene, projection, true);
  if (scene.view.kind === "camera") {
    return {
      position: tuple(projectVisualPoint(scene.view.position, projection)),
      target: tuple(projectVisualPoint(scene.view.target, projection)),
      projection: { kind: "perspective" },
    };
  }
  const target =
    scene.view.kind === "isometric" && scene.view.target
      ? projectVisualPoint(scene.view.target, projection)
      : {
          x: (bounds.x.min + bounds.x.max) / 2,
          y: (bounds.y.min + bounds.y.max) / 2,
          z: (bounds.z.min + bounds.z.max) / 2,
        };
  const direction =
    scene.space === "plane"
      ? { x: 0, y: 0, z: 15 }
      : { x: 12, y: scene.view.kind === "isometric" ? 12 : 8, z: 12 };
  return {
    position: [
      target.x + direction.x,
      target.y + direction.y,
      target.z + direction.z,
    ],
    target: tuple(target),
    projection: {
      kind:
        scene.space === "plane" || scene.view.kind === "isometric"
          ? "orthographic"
          : "perspective",
    },
  };
}
