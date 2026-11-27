import {
  SHANK_DIAMETER,
  SHANK_LENGTH,
} from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";
import {
  hexagonRadius,
  stationsBetween,
  threadRadius,
} from "@repo/design-system/components/three/instrument/radial";

/**
 * The shape of an M10 hexagon head bolt (ISO 4014), in millimetres along its
 * axis from the underside of the head: a forged head 16 across its flats
 * with its 30 degree chamfer and washer face, a plain shank, and a rolled
 * thread of 1.5 pitch that runs out into the shank and ends in a chamfered
 * tip.
 */

/** The head: half its width across flats, its thickness, and the radius its chamfer starts at. */
const HEAD = { chamfer: 7.5, flats: 8, thick: 6.4, washer: 7.4 } as const;

/** The thread: where it starts, its pitch, its depth, and how far its runout takes. */
const THREAD = { depth: 0.92, from: 22.5, pitch: 1.5, runout: 2.2 } as const;

/** How long the chamfer at the tip is. */
const TIP = 1.2;

/** The shank's radius. */
const SHANK = SHANK_DIAMETER / 2;

/** How steeply the head's chamfer widens along the axis: 30 degrees from its top face. */
const CHAMFER_SLOPE = 1 / Math.tan(Math.PI / 6);

/** How far the head reaches from the axis: its thickness across flats and across corners. */
export const HEAD_REACH = {
  corners: HEAD.flats / Math.cos(Math.PI / 6),
  flats: HEAD.flats,
  thick: HEAD.thick,
} as const;

/** The rings of the head: close at its two faces, fine through its chamfer. */
export const HEAD_STATIONS = [
  -HEAD.thick,
  -HEAD.thick + 0.001,
  ...stationsBetween(-HEAD.thick + 0.12, -HEAD.thick + 1.2, 0.12),
  -0.401,
  -0.4,
  -0.001,
  0,
];

/** The rings of the shank: one at each end of the plain part, eleven to every turn of the thread. */
export const SHANK_STATIONS = [
  0,
  0.001,
  ...stationsBetween(THREAD.from, SHANK_LENGTH - 0.001, THREAD.pitch / 11),
  SHANK_LENGTH,
];

/** The head's radius: a hexagon with a flat down, cut by its chamfer on top and its washer face below. */
export function headRadius(along: number, angle: number) {
  if (along <= -HEAD.thick || along >= 0) {
    return 0;
  }
  return Math.min(
    hexagonRadius(HEAD.flats, angle + Math.PI / 6),
    HEAD.chamfer + (along + HEAD.thick) * CHAMFER_SLOPE,
    along > -0.4005 ? HEAD.washer : Number.POSITIVE_INFINITY
  );
}

/** The shank's radius: plain to where the thread runs in, then a helix to the chamfered tip. */
export function shankRadius(along: number, angle: number) {
  if (along <= 0 || along >= SHANK_LENGTH) {
    return 0;
  }
  if (along <= THREAD.from) {
    return SHANK;
  }
  const depth =
    THREAD.depth * Math.min(1, (along - THREAD.from) / THREAD.runout);
  return Math.min(
    threadRadius({ crest: SHANK, depth, pitch: THREAD.pitch }, along, angle),
    SHANK - Math.max(0, along - (SHANK_LENGTH - TIP))
  );
}
