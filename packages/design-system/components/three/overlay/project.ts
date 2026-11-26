import type { Size } from "@react-three/fiber";
import type { Camera, OrthographicCamera, PerspectiveCamera } from "three";
import { Vector3 } from "three";

function isOrthographicCamera(camera: Camera): camera is OrthographicCamera {
  return (
    "isOrthographicCamera" in camera && camera.isOrthographicCamera === true
  );
}

function isPerspectiveCamera(camera: Camera): camera is PerspectiveCamera {
  return "isPerspectiveCamera" in camera && camera.isPerspectiveCamera === true;
}

/** Reusable scratch vectors to keep per-frame overlay projections allocation-free. */
const SCRATCH_NDC = new Vector3();
const SCRATCH_CAMERA_POS = new Vector3();
const SCRATCH_CAMERA_DIR = new Vector3();
const SCRATCH_OFFSET = new Vector3();

/**
 * Whether a canvas has a positive finite box that can project 3D world anchors
 * into overlay coordinates. A zero-sized frame before layout settles would
 * project every anchor onto the top-left corner `(0, 0)`.
 */
export function hasRenderableOverlaySize(
  size: Pick<Size, "height" | "width">
): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/**
 * Whether an overlay label needs a fresh DOM style write, either because its
 * DOM frame has never been placed yet or because its projected position,
 * visibility, scale, or camera zoom changed past `tolerance`.
 */
export function hasOverlayPlacementChanged(
  last: {
    readonly scale: number;
    readonly visible: boolean;
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  },
  next: {
    readonly scale: number;
    readonly visible: boolean;
    readonly wasPlaced: boolean;
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  },
  tolerance: number
): boolean {
  return (
    !next.wasPlaced ||
    last.visible !== next.visible ||
    Math.abs(last.zoom - next.zoom) > tolerance ||
    Math.abs(last.scale - next.scale) > tolerance ||
    Math.abs(last.x - next.x) > tolerance ||
    Math.abs(last.y - next.y) > tolerance
  );
}

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
  SCRATCH_NDC.copy(point).project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [
    SCRATCH_NDC.x * widthHalf + widthHalf,
    -(SCRATCH_NDC.y * heightHalf) + heightHalf,
  ];
}

/** Whether a point lies more than a right angle away from the camera's view direction. */
export function isBehindCamera(point: Vector3, camera: Camera): boolean {
  camera.getWorldPosition(SCRATCH_CAMERA_POS);
  camera.getWorldDirection(SCRATCH_CAMERA_DIR);
  SCRATCH_OFFSET.copy(point).sub(SCRATCH_CAMERA_POS);
  return SCRATCH_OFFSET.angleTo(SCRATCH_CAMERA_DIR) > Math.PI / 2;
}

/**
 * The factor that keeps a label at a constant size in world units: the zoom of
 * an orthographic camera, or the world size of one pixel at the point's distance
 * from a perspective camera.
 */
export function objectScale(point: Vector3, camera: Camera): number {
  if (isOrthographicCamera(camera)) {
    return camera.zoom;
  }
  if (isPerspectiveCamera(camera)) {
    const verticalFov = (camera.fov * Math.PI) / 180;
    const distance = point.distanceTo(
      camera.getWorldPosition(SCRATCH_CAMERA_POS)
    );
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
  if (!(isPerspectiveCamera(camera) || isOrthographicCamera(camera))) {
    return undefined;
  }
  const distance = point.distanceTo(
    camera.getWorldPosition(SCRATCH_CAMERA_POS)
  );
  const slope = (range[1] - range[0]) / (camera.far - camera.near);
  const intercept = range[1] - slope * camera.far;
  return Math.round(slope * distance + intercept);
}

/**
 * Whether a label lies strictly nearer the camera than the nearest object that
 * its camera ray hits. A ray that hits nothing leaves the label unobstructed,
 * and a label at the same distance as the hit counts as obstructed, as in drei.
 */
export function isNearerThanHit(
  labelDistance: number,
  hitDistance: number | undefined
): boolean {
  return hitDistance === undefined || labelDistance < hitDistance;
}
