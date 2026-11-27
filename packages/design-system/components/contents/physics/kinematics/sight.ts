import { Array as Arr } from "effect";

/** A place in a scene, or a direction in it: along x, up y and along z. */
type Place = readonly [x: number, y: number, z: number];

/** The frame a camera draws into and how much of it the subject may take. */
interface Frame {
  /** The share of the frame the subject may span, from 0 to 1: the rest is the margin around it. */
  readonly fill: number;
  /** The camera's vertical angle of view, in degrees. */
  readonly fov: number;
  /** The frame's width over its height. */
  readonly shape: number;
}

/** How far a place lies along a direction. */
function along(place: Place, direction: Place) {
  return (
    place[0] * direction[0] + place[1] * direction[1] + place[2] * direction[2]
  );
}

/**
 * The nearest place a camera can stand to hold every one of `points` in its
 * frame while it looks along `toward`, and the place it looks at there.
 *
 * A lab says what must be seen and from which side; the frame decides how
 * near the camera may come. A wide frame is bound by its height and a narrow
 * one by its width, so the same subject fills the frame at every width, and
 * a subject that grows moves the camera back by as much as it needs. The
 * camera is centred on what it holds, across and up, so the margin is the
 * same on both sides.
 *
 * @param points - Every place that must stay in the frame, in metres, at least one
 * @param toward - The way the camera looks, of any length, never straight up or down
 * @param frame - The frame's shape, the angle of view and the share to fill
 */
export function sightOver(
  points: readonly Place[],
  toward: Place,
  frame: Frame
) {
  const length = Math.hypot(toward[0], toward[1], toward[2]);
  const ahead = [
    toward[0] / length,
    toward[1] / length,
    toward[2] / length,
  ] as const;
  const level = Math.hypot(ahead[0], ahead[2]);
  const right = [-ahead[2] / level, 0, ahead[0] / level] as const;
  const up = [
    -right[2] * ahead[1],
    right[2] * ahead[0] - right[0] * ahead[2],
    right[0] * ahead[1],
  ] as const;
  const tall = Math.tan((frame.fov * Math.PI) / 360) * frame.fill;
  const wide = tall * frame.shape;
  const seen = Arr.map(
    points,
    (point) =>
      [along(point, right), along(point, up), along(point, ahead)] as const
  );

  // Each edge of the frame is a plane through the camera. The camera stands
  // behind the plane every point pushes furthest, on all four sides.
  const leftmost = Math.max(...Arr.map(seen, ([x, , z]) => x - wide * z));
  const rightmost = Math.min(...Arr.map(seen, ([x, , z]) => x + wide * z));
  const lowest = Math.max(...Arr.map(seen, ([, y, z]) => y - tall * z));
  const highest = Math.min(...Arr.map(seen, ([, y, z]) => y + tall * z));
  const depth = Math.min(
    (rightmost - leftmost) / (2 * wide),
    (highest - lowest) / (2 * tall)
  );
  const across = (leftmost + rightmost) / 2;
  const over = (lowest + highest) / 2;
  const middle =
    Arr.reduce(seen, 0, (sum, [, , z]) => sum + z) / seen.length - depth;
  const position = [
    across * right[0] + over * up[0] + depth * ahead[0],
    over * up[1] + depth * ahead[1],
    across * right[2] + over * up[2] + depth * ahead[2],
  ] as const;

  return {
    position,
    target: [
      position[0] + middle * ahead[0],
      position[1] + middle * ahead[1],
      position[2] + middle * ahead[2],
    ] as const,
  };
}
