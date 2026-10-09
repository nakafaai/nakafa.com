import type { Size } from "@react-three/fiber";
import {
  type Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from "three";

/**
 * Projects a world point to CSS pixels with the origin at the top left of the
 * canvas. Points behind a perspective camera project to mirrored positions,
 * and the caller hides them with `isBehindCamera`.
 */
export function projectToOverlay(
  point: Vector3,
  camera: Camera,
  size: Size
): [number, number] {
  const ndc = point.clone().project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [ndc.x * widthHalf + widthHalf, -(ndc.y * heightHalf) + heightHalf];
}

/** Whether a point lies more than a right angle away from the camera's view direction. */
export function isBehindCamera(point: Vector3, camera: Camera): boolean {
  const offset = point.clone().sub(camera.getWorldPosition(new Vector3()));
  return offset.angleTo(camera.getWorldDirection(new Vector3())) > Math.PI / 2;
}

/**
 * The factor that keeps a label at a constant size in world units: the zoom of
 * an orthographic camera, or the world size of one pixel at the point's distance
 * from a perspective camera.
 */
export function objectScale(point: Vector3, camera: Camera): number {
  if (camera instanceof OrthographicCamera) {
    return camera.zoom;
  }
  if (camera instanceof PerspectiveCamera) {
    const verticalFov = (camera.fov * Math.PI) / 180;
    const distance = point.distanceTo(camera.getWorldPosition(new Vector3()));
    return 1 / (2 * Math.tan(verticalFov / 2) * distance);
  }
  return 1;
}

/**
 * Maps the point's distance from the camera linearly from the near plane onto
 * `range[0]` and from the far plane onto `range[1]`, then rounds the result.
 * A camera without near and far planes has no depth order, so it returns undefined.
 */
export function objectZIndex(
  point: Vector3,
  camera: Camera,
  range: readonly [number, number]
): number | undefined {
  if (
    !(
      camera instanceof PerspectiveCamera ||
      camera instanceof OrthographicCamera
    )
  ) {
    return undefined;
  }
  const distance = point.distanceTo(camera.getWorldPosition(new Vector3()));
  const slope = (range[1] - range[0]) / (camera.far - camera.near);
  const intercept = range[1] - slope * camera.far;
  return Math.round(slope * distance + intercept);
}
