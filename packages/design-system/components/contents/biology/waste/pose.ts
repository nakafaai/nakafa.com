import {
  isSpilling,
  POUR_TILT,
} from "@repo/design-system/components/contents/biology/waste/pour";
import type {
  Leg,
  Route,
} from "@repo/design-system/components/contents/biology/waste/route";
import {
  durationOf,
  isPouredInto,
  pourOf,
  RISE,
  shareOf,
} from "@repo/design-system/components/contents/biology/waste/route";
import type { Point } from "@repo/design-system/components/contents/biology/waste/station";
import {
  AUTOCLAVE,
  add,
  CONTAINER,
  LID_LIFT,
  lerp,
  PointSchema,
} from "@repo/design-system/components/contents/biology/waste/station";
import { Array as Arr, Option, Schema } from "effect";

/** Eases a share in and out, so nothing starts or stops with a jolt. */
export function ease(share: number) {
  return share * share * (3 - 2 * share);
}

/** The point `share` of the way along an arc from `from` to `to` that rises to `apex`: a quadratic Bezier curve. */
export function arcPoint(from: Point, to: Point, share: number, apex: number) {
  const control: Point = [
    (from[0] + to[0]) / 2,
    2 * apex - (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  return lerp(lerp(from, control, share), lerp(control, to, share), share);
}

/** What the station looks like at one moment of a route. */
const PoseSchema = Schema.Struct({
  container: PointSchema,
  heat: Schema.Finite,
  item: PointSchema,
  lid: Schema.Finite,
  pouring: Schema.Boolean,
  rotation: Schema.Finite,
  tap: Schema.Boolean,
});
export type Pose = typeof PoseSchema.Type;

/** Where the inner container stands in the autoclave: on the rack in the chamber. */
const LOADED: Point = [AUTOCLAVE.at[0], AUTOCLAVE.floor, AUTOCLAVE.at[2]];

/** How far the container's foot clears the autoclave's rim as it is carried across, in metres. */
const CLEARANCE = 0.045;

/** The shares of loading at which the container stops rising and starts lowering. */
const LOADING = { lower: 0.7, rise: 0.3 } as const;

/**
 * Where the container's foot is `share` of the way through being loaded:
 * lifted straight up until it clears the autoclave's rim, carried across
 * level, then lowered straight onto the rack, so it never passes through
 * the rim.
 */
export function loadPoint(share: number): Point {
  const high = AUTOCLAVE.rim + CLEARANCE;
  const [hx, , hz] = CONTAINER.home;
  const [lx, ly, lz] = LOADED;
  if (share < LOADING.rise) {
    return [hx, high * ease(share / LOADING.rise), hz];
  }
  if (share < LOADING.lower) {
    const across = (share - LOADING.rise) / (LOADING.lower - LOADING.rise);
    return lerp([hx, high, hz], [lx, high, lz], ease(across));
  }
  const down = (share - LOADING.lower) / (1 - LOADING.lower);
  return [lx, high + (ly - high) * ease(down), lz];
}

/** How far a blade or slide turns to stand on its edge as it is carried, so it goes through the sharps container's aperture. */
const POSTING = Math.PI / 2;

/**
 * Where the item is `seconds` into `route`, how far it is turned about x
 * (stood on edge for the sharps container, tipped to pour), and where the
 * autoclave's container, lid and cycle are. Before the route starts the
 * item waits on the tray; after it ends everything holds its last pose.
 */
export function poseAt(route: Route, seconds: number): Pose {
  const share = (kind: Leg["kind"]) => shareOf(route, kind, seconds);
  const container = loadPoint(share("load"));
  const poured = Option.getOrUndefined(
    Option.map(pourOf(route.place), (pour) => pour.vessel)
  );
  const rotation = rotationAt(route, share);
  return {
    container,
    heat: share("heat"),
    item: itemAt(route, share, container),
    lid: LID_LIFT * (ease(share("open")) - ease(share("close"))),
    pouring: poured !== undefined && isSpilling(poured, rotation),
    rotation,
    tap: route.place === "sink" && share("carry") >= 1,
  };
}

/** How far the item is turned about x, given how far through each leg the route is. */
function rotationAt(route: Route, share: (kind: Leg["kind"]) => number) {
  if (isPouredInto(route.place)) {
    return -POUR_TILT * ease(share("tip"));
  }
  return route.place === "sharps" ? POSTING * ease(share("carry")) : 0;
}

/** Where the item is, given how far through each leg the route is and where the container stands. */
function itemAt(
  route: Route,
  share: (kind: Leg["kind"]) => number,
  container: Point
): Point {
  if (share("lift") < 1) {
    return lerp(route.start, route.lifted, ease(share("lift")));
  }
  if (share("carry") < 1) {
    return arcPoint(
      route.lifted,
      route.entry,
      ease(share("carry")),
      Math.max(route.lifted[1], route.entry[1]) + RISE.arc
    );
  }
  if (isPouredInto(route.place)) {
    return lerp(route.entry, route.rest, ease(share("tip")));
  }
  const fallen = lerp(route.entry, route.rest, share("drop") ** 2);
  const [hx, hy, hz] = CONTAINER.home;
  return add(fallen, [container[0] - hx, container[1] - hy, container[2] - hz]);
}

/** The way the item travels along `route`, as points `samples` steps apart in time, for the route's line. */
export function pathOf(route: Route, samples: number) {
  const total = durationOf(route);
  return Arr.dedupeAdjacentWith(
    Arr.makeBy(
      samples + 1,
      (step) => poseAt(route, (total * step) / samples).item
    ),
    (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
  );
}
