import { placeDigits } from "@repo/design-system/components/contents/mathematics/bundle/digits";
import {
  boxOnTray,
  boxSize,
  HEAP,
  heapRadius,
  STICK,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import { LIFT } from "@repo/design-system/components/contents/mathematics/bundle/staging";
import {
  deskZones,
  zoneFootprint,
} from "@repo/design-system/components/contents/mathematics/bundle/zones";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr } from "effect";

/**
 * The part of the desk the camera frames, built from the zones' own bounds.
 * At rest it holds the finished desk: each zone's things as they lie at
 * the end. While the sticks are being bundled it also holds the heap, the
 * piles that wait for the next round, and the height things rise to in
 * flight, so nothing leaves the picture mid-round. A margin round the sides
 * leaves the things about three quarters of the picture once the camera
 * fits the frame.
 */

/** How much of the frame's width and depth the margin adds on each side. */
const MARGIN = 0.08;

/** The smallest frame holding both `a` and `b`. */
function union(a: CoordinateFrame, b: CoordinateFrame): CoordinateFrame {
  const span = (axis: "x" | "y" | "z") => ({
    max: Math.max(a[axis].max, b[axis].max),
    min: Math.min(a[axis].min, b[axis].min),
  });
  return { x: span("x"), y: span("y"), z: span("z") };
}

/** `frame` widened by the margin on every side of the desk, and left as tall as it is. */
function withMargin(frame: CoordinateFrame): CoordinateFrame {
  const wide = MARGIN * (frame.x.max - frame.x.min);
  const deep = MARGIN * (frame.z.max - frame.z.min);
  return {
    x: { max: frame.x.max + wide, min: frame.x.min - wide },
    y: frame.y,
    z: { max: frame.z.max + deep, min: frame.z.min - deep },
  };
}

/** Where every stick of the heap can lie: each stick's middle within the heap's radius, and the stick half its length round it. */
function heapFrame(count: number): CoordinateFrame {
  const reach = heapRadius(count) + STICK.length / 2;
  return {
    x: { max: HEAP.x + reach, min: HEAP.x - reach },
    y: { max: 0, min: 0 },
    z: { max: HEAP.z + reach, min: HEAP.z - reach },
  };
}

/**
 * The frame of `count` sticks in `base`: the finished desk at rest, and,
 * with `inRun`, everything the rounds move as well.
 */
export function deskFrame(
  count: number,
  base: number,
  inRun: boolean
): CoordinateFrame {
  const zones = deskZones(count, base);
  const digits = placeDigits(count, base);
  const footprints = Arr.map(zones, (zone, place) => {
    // While the rounds run, a zone of bundles or boxes holds everything its
    // round makes; at rest, and for loose sticks and trays, only its digit.
    const digit = Arr.getUnsafe(digits, place);
    const things =
      inRun && place > 0 ? Math.floor(count / base ** place) : digit;
    // A tray's boxes stand above its rim.
    const rise =
      place === 3
        ? boxOnTray(0, base).y + boxSize(base).height
        : zone.size.height;
    return zoneFootprint(zone, things, rise);
  });
  const desk = Arr.reduce(
    Arr.drop(footprints, 1),
    Arr.getUnsafe(footprints, 0),
    union
  );
  if (!inRun) {
    return withMargin(desk);
  }
  const moving = union(desk, heapFrame(count));
  return withMargin({
    ...moving,
    y: { max: moving.y.max + LIFT, min: 0 },
  });
}
