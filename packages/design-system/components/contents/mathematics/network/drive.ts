import type { Town } from "@repo/design-system/components/contents/mathematics/network/graph";
import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import { Array as Arr, Option, Schema } from "effect";

/** How fast the van drives on the board, in metres a second. */
export const VAN_SPEED = 0.16;

/** How long the van waits at the end of a route before the next, in seconds. */
export const VAN_REST = 1.1;

/** How long the counting tour of the degrees mode stays on each town, in seconds. */
export const COUNT_STEP = 1.4;

/** Where the van is and which way it faces: its heading turns the board's x axis toward the road. */
const PoseSchema = Schema.Struct({
  heading: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Pose = typeof PoseSchema.Type;

/** One drive of a run: when it starts and stops, in seconds, and how far it goes, in metres. */
const DriveSchema = Schema.Struct({
  end: Schema.Finite,
  length: Schema.Finite,
  start: Schema.Finite,
});
type Drive = typeof DriveSchema.Type;

/** How long a line through `points` is, in metres. */
export function pathLength(points: readonly Spot[]) {
  return Arr.reduce(Arr.drop(points, 1), 0, (sum, point, index) => {
    const from = Arr.getUnsafe(points, index);
    return sum + Math.hypot(point.x - from.x, point.z - from.z);
  });
}

/** The heading of a step from `from` to `to`, for a van that faces along x. */
function headingOf(from: Spot, to: Spot) {
  return Math.atan2(-(to.z - from.z), to.x - from.x);
}

/**
 * Where a van stands `distance` metres along the line through `points`, and
 * which way it faces. Before the line it waits at the first point, past it at
 * the last, facing along the nearest stretch.
 */
export function pointAlong(points: readonly Spot[], distance: number): Pose {
  const first = Arr.getUnsafe(points, 0);
  let left = Math.max(0, distance);
  let pose: Pose = { heading: 0, x: first.x, z: first.z };
  for (let step = 1; step < points.length; step += 1) {
    const from = Arr.getUnsafe(points, step - 1);
    const to = Arr.getUnsafe(points, step);
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const share = Math.min(1, left / Math.max(length, 1e-9));
    pose = {
      heading: headingOf(from, to),
      x: from.x + (to.x - from.x) * share,
      z: from.z + (to.z - from.z) * share,
    };
    if (left <= length) {
      return pose;
    }
    left -= length;
  }
  return pose;
}

/**
 * The run of drives of the given lengths, one after the other at
 * `VAN_SPEED`, each followed by a rest of `VAN_REST`. The run lasts until the
 * last rest ends.
 */
export function driveSchedule(lengths: readonly number[]) {
  const drives = Arr.reduce(lengths, Arr.empty<Drive>(), (done, length) => {
    const start =
      done.length === 0
        ? 0
        : Arr.getUnsafe(done, done.length - 1).end + VAN_REST;
    return [...done, { end: start + length / VAN_SPEED, length, start }];
  });
  const total = Arr.match(drives, {
    onEmpty: () => 0,
    onNonEmpty: (all) => Arr.lastNonEmpty(all).end + VAN_REST,
  });
  return { drives, total };
}

/** Which drive of a run is under way at `time`, and how far along it the van is. */
export function driveAt(drives: readonly Drive[], time: number) {
  const index = Math.max(
    0,
    Arr.reduce(drives, -1, (found, drive, at) =>
      drive.start <= time ? at : found
    )
  );
  const drive = Arr.getUnsafe(drives, index);
  const share = (time - drive.start) / Math.max(drive.end - drive.start, 1e-9);
  return {
    distance: drive.length * Math.min(1, Math.max(0, share)),
    index,
  };
}

/**
 * The town that the counting tour stands on `time` seconds into it: the tour
 * visits the towns in their order, one step each, and has none once it has
 * visited them all.
 */
export function countedAt(towns: readonly Town[], time: number) {
  return Option.map(
    Arr.get(towns, Math.floor(time / COUNT_STEP)),
    (town) => town.id
  );
}
