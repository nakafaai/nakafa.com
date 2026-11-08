import type { Camera } from "@react-three/fiber";
import { OrthographicCamera, Vector3 } from "three";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";

/**
 * How many art pixels one world unit (one cell) spans along a grid axis on
 * screen: one per voxel, so a cell's top is a diamond 16 pixels wide and every
 * grid edge steps two across, one up (ADR 0042, D15).
 */
export const PIXELS_PER_UNIT = VOXELS_PER_CELL / Math.cos(Math.PI / 4);

/** The camera's tilt above the ground, which draws grid edges at exactly 2 to 1. */
const ELEVATION = Math.PI / 6;

/** The camera's turn around the island, before the island itself turns in quarter steps. */
const AZIMUTH = Math.PI / 4;

/** How far the camera stands from what it looks at; it is orthographic, so only the order of depth matters. */
const DISTANCE = 60;

/** The point the camera looks at: the island's middle, a little below its top surface. */
const TARGET_DEPTH = -0.9;

/** Rounds a length in world units to whole art pixels. */
function toPixel(length: number) {
  return Math.round(length * PIXELS_PER_UNIT) / PIXELS_PER_UNIT;
}

/**
 * The island's camera for a buffer of `columns` by `rows` art pixels:
 * orthographic, turned 45 degrees and tilted 30, one world unit spanning
 * `PIXELS_PER_UNIT` buffer pixels along a grid axis (ADR 0042, D15). The point
 * it looks at moves by less than a pixel so that the world's origin falls on a
 * pixel corner, which keeps every voxel edge on the same pixel pattern however
 * the island is framed. It is marked manual, so the canvas leaves its frustum
 * alone when it resizes: a new buffer gets a new camera.
 */
export function cameraFor(size: number, columns: number, rows: number) {
  const width = columns / 2 / PIXELS_PER_UNIT;
  const height = rows / 2 / PIXELS_PER_UNIT;
  const camera: Camera = new OrthographicCamera(
    -width,
    width,
    height,
    -height,
    1,
    DISTANCE * 2
  );
  camera.rotation.set(-ELEVATION, AZIMUTH, 0, "YXZ");
  const right = new Vector3(1, 0, 0).applyEuler(camera.rotation);
  const up = new Vector3(0, 1, 0).applyEuler(camera.rotation);
  const back = new Vector3(0, 0, 1).applyEuler(camera.rotation);
  const target = new Vector3(size / 2, TARGET_DEPTH, size / 2);
  const alongRight = target.dot(right);
  const alongUp = target.dot(up);
  target
    .addScaledVector(right, toPixel(alongRight) - alongRight)
    .addScaledVector(up, toPixel(alongUp) - alongUp);
  camera.position.copy(target).addScaledVector(back, DISTANCE);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  camera.manual = true;
  return camera;
}

/** The art pixel's size in CSS pixels when the island fits, and its bounds for zoom. */
export const DEFAULT_ART_PIXEL = 3;
const LARGEST_ART_PIXEL = 6;

/** The space around an island's body, in art pixels, for its trees, roofs and clouds. */
const MARGIN = { bottom: 60, side: 24, top: 56 };

/** How tall the island's body draws below its top surface, in art pixels. */
const BODY_PIXELS = 30;

/**
 * The art pixel that fits an island of `size` cells into a frame: the default
 * when it fits, smaller when the frame is too small, never below one CSS pixel
 * or a fraction of one, so every art pixel stays square and sharp.
 */
export function artPixelFor(width: number, height: number, size: number) {
  const islandWidth = size * 2 * VOXELS_PER_CELL + MARGIN.side * 2;
  const islandHeight =
    size * VOXELS_PER_CELL + BODY_PIXELS + MARGIN.top + MARGIN.bottom;
  const fits = Math.floor(Math.min(width / islandWidth, height / islandHeight));
  return Math.max(1, Math.min(DEFAULT_ART_PIXEL, fits));
}

/** Moves an art pixel one zoom step in or out, within its bounds. */
export function zoomed(artPixel: number, step: 1 | -1) {
  return Math.max(1, Math.min(LARGEST_ART_PIXEL, artPixel + step));
}

/**
 * The drawing buffer for a frame at one art pixel: whole art pixels, an even
 * number each way so the island's centre falls on a pixel corner, and the CSS
 * size that shows each buffer pixel as exactly one art pixel.
 */
export function bufferFor(width: number, height: number, artPixel: number) {
  const columns = Math.max(2, Math.floor(width / artPixel / 2) * 2);
  const rows = Math.max(2, Math.floor(height / artPixel / 2) * 2);
  return {
    columns,
    cssHeight: rows * artPixel,
    cssWidth: columns * artPixel,
    rows,
  };
}
