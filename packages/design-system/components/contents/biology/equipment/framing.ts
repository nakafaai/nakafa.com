import type {
  Equipment,
  Triple,
} from "@repo/design-system/components/contents/biology/equipment/places";
import {
  PLACES,
  TripleSchema,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { Schema } from "effect";

/** The middle of an item, half its height above its foot. */
export function middleOf(item: Equipment): Triple {
  const { base, size } = PLACES[item];
  return [base[0], base[1] + size[1] / 2, base[2]];
}

/** The top of an item, where its name stands. */
export function topOf(item: Equipment): Triple {
  const { base, size } = PLACES[item];
  return [base[0], base[1] + size[1], base[2]];
}

/** The radius of the smallest ball that holds an item: half the diagonal of its box. */
export function reachOf(item: Equipment) {
  const [width, height, depth] = PLACES[item].size;
  return Math.hypot(width, height, depth) / 2;
}

/** A pose of the camera: where it stands and the point it looks at, in metres. */
const PoseSchema = Schema.Struct({
  position: TripleSchema,
  target: TripleSchema,
});
export type Pose = typeof PoseSchema.Type;

/**
 * How far a ball of `radius` must stand from a camera of vertical field of
 * view `fov` degrees on a canvas `aspect` wide to its height, to fill `share`
 * of the narrower side. On a portrait canvas the width is the narrower side,
 * so the horizontal half angle, `atan(tan(fov / 2) * aspect)`, sets the
 * distance.
 */
export function fitDistance(
  radius: number,
  fov: number,
  aspect: number,
  share: number
) {
  const vertical = (fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return radius / share / Math.sin(Math.min(vertical, horizontal));
}

/** Walks `distance` from `target` along `direction`, which need not be a unit vector. */
function standOff(target: Triple, direction: Triple, distance: number): Triple {
  const length = Math.hypot(...direction);
  return [
    target[0] + (direction[0] / length) * distance,
    target[1] + (direction[1] / length) * distance,
    target[2] + (direction[2] / length) * distance,
  ];
}

/** How much of the narrower side a picked item fills, leaving room for its name above it. */
const FOCUS_SHARE = 0.62;

/** The camera's pose for one picked item: looking at its middle from its own side, close enough to fill the frame. */
export function focusPose(item: Equipment, fov: number, aspect: number): Pose {
  const target = middleOf(item);
  return {
    position: standOff(
      target,
      PLACES[item].view,
      fitDistance(reachOf(item), fov, aspect, FOCUS_SHARE)
    ),
    target,
  };
}

/**
 * The first view: the whole corner from the room, the bench, the fume
 * chamber and the side wall, which spans about 3.6 m across as the camera
 * sees it.
 */
const OverviewSchema = Schema.Struct({
  direction: TripleSchema,
  span: Schema.Finite,
  target: TripleSchema,
});

const OVERVIEW: typeof OverviewSchema.Type = {
  direction: [0.62, 0.42, 0.85],
  span: 3.6,
  target: [0.05, 1.05, 0.15],
};

/** The camera's first view of the corner, farther back on a narrow canvas so the whole corner still fits. */
export function overviewPose(fov: number, aspect: number): Pose {
  return {
    position: standOff(
      OVERVIEW.target,
      OVERVIEW.direction,
      fitDistance(OVERVIEW.span / 2, fov, aspect, 1)
    ),
    target: OVERVIEW.target,
  };
}

/**
 * A smooth start and stop for a camera move, `t` from 0 to 1: the cubic
 * that eases in and out, held at its ends outside that range.
 */
export function easeInOut(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/** A point between `from` and `to`, at `share` of the way. */
export function between(from: Triple, to: Triple, share: number): Triple {
  return [
    from[0] + (to[0] - from[0]) * share,
    from[1] + (to[1] - from[1]) * share,
    from[2] + (to[2] - from[2]) * share,
  ];
}

/** One camera move: the pose it leaves and the pose it reaches. */
const FlightSchema = Schema.Struct({ from: PoseSchema, to: PoseSchema });
export type Flight = typeof FlightSchema.Type;

/**
 * How bright the picked item's spotlight is where it lands, in lux: a little
 * over half of the room's key light, so the item stands out without glaring.
 */
const SPOT_LUX = 0.9;

/**
 * The spotlight on a picked item: it hangs above the item on the camera's
 * side, far enough to light the whole item, its cone just wide enough to
 * hold it, and as bright as `SPOT_LUX` where it lands, since a spotlight's
 * light falls off with the square of the distance.
 */
export function spotOf(item: Equipment) {
  const target = middleOf(item);
  const reach = reachOf(item);
  const distance = 0.45 + 3 * reach;
  const [x, y, z] = PLACES[item].view;
  return {
    angle: Math.atan((1.5 * reach) / distance),
    intensity: SPOT_LUX * distance ** 2,
    position: standOff(target, [x, y + 1.5, z], distance),
    target,
  };
}
