import { Schema } from "effect";

/** A point in the station, in metres: x to the right, y up from the bench top, z towards the reader. */
export const PointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Point = typeof PointSchema.Type;

/** The sum of two points. */
export function add([ax, ay, az]: Point, [bx, by, bz]: Point): Point {
  return [ax + bx, ay + by, az + bz];
}

/** The point `share` of the way from `from` to `to`. */
export function lerp(
  [ax, ay, az]: Point,
  [bx, by, bz]: Point,
  share: number
): Point {
  return [
    ax + (bx - ax) * share,
    ay + (by - ay) * share,
    az + (bz - az) * share,
  ];
}

/**
 * The bench: 0.9 m high, the standing height EN 13150 gives for secondary
 * school laboratory benches, with a 25 mm (1 in) epoxy resin top.
 *
 * @see https://standards.iteh.ai/catalog/standards/cen/01e1ee23-cab0-4826-9529-1ed405408a5b/en-13150-2001
 * @see https://www.durcon.com/epoxy-resin-sinks-page
 */
export const BENCH = {
  depth: 0.75,
  height: 0.9,
  top: 0.025,
  width: 1.5,
} as const;

/**
 * An epoxy resin undermount sink, 16 × 12 in inside and 8 in deep (Durcon
 * U15C), its middle at `at`.
 *
 * @see https://durcon.com/undermount-sink-snku-03
 */
export const SINK = {
  at: [-0.42, 0, -0.14],
  depth: 0.2032,
  length: 0.4064,
  width: 0.3048,
} as const;

/**
 * The chemical waste bottle: a 2.5 L amber glass Winchester, 297 mm tall and
 * 132.9 mm across, with a neck about 28 mm across.
 *
 * @see https://philipharris.co.uk/product/glassware-plastics-and-ceramics/bottles/glass/winchester-bottle-amber-glass-25l/b8a56340
 * @see https://breckland-scientific-supplies-ltd.helpjuice.com/bottles/winchester-bottle-25l-amber
 */
export const BOTTLE = {
  at: [-0.1, 0, -0.21],
  height: 0.297,
  neck: 0.014,
  radius: 0.066_45,
} as const;

/** The 75 mm funnel in the waste bottle's neck: its mouth's radius, the depth of its cone and the length of its stem. */
export const FUNNEL = { cone: 0.045, radius: 0.0375, stem: 0.04 } as const;

/** The rim of the funnel's mouth above the bench: its cone stands 5 mm above the bottle's neck. */
export const FUNNEL_TOP = BOTTLE.height + 0.005 + FUNNEL.cone;

/** The sharps container's capacity in cubic metres: 2.5 L. */
const SHARPS_VOLUME = 0.0025;

/**
 * A yellow 2.5 L sharps container (Sharpsguard eco 2.5): 176 mm wide and
 * 163 mm tall, as deep as holding its 2.5 L takes, with a 77 × 45 mm
 * aperture in its lid.
 *
 * @see https://www.hce-uk.com/product/daniels-sharpsguard-yellow-2-5-litre-sharps-bin/
 */
export const SHARPS = {
  aperture: [0.077, 0.045],
  at: [0.02, 0, 0.2],
  depth: SHARPS_VOLUME / (0.176 * 0.163),
  height: 0.163,
  width: 0.176,
} as const;

/**
 * How full a sharps container may be filled: to its line at three quarters,
 * so nothing pokes out of the closed lid.
 *
 * @see https://www.cehjournal.org/?p=32749
 */
export const FILL_LIMIT = 0.75;

/**
 * A benchtop broken glass box of polyethylene-lined corrugated card,
 * 8 × 8 × 10 in.
 *
 * @see https://www.fishersci.com/shop/products/fisherbrand-glass-disposal-boxes-6/120097A
 */
export const GLASS_BOX = {
  at: [0.12, 0, -0.2],
  height: 0.254,
  side: 0.2032,
} as const;

/**
 * A benchtop electric steam sterilizer of the All American 25X kind: 16.75 in
 * tall overall with a body 12-5/8 in across inside. Its electric base is
 * `base` tall, the chamber's rack stands at `floor` and the lid seats on the
 * rim at `rim`.
 *
 * @see https://nelsonjameson.com/lab-alog_2016/files/assets/basic-html/page-23.html
 */
export const AUTOCLAVE = {
  at: [0.46, 0, -0.15],
  base: 0.075,
  bore: 0.160_34,
  floor: 0.095,
  height: 0.4255,
  rim: 0.355,
} as const;

/** How high the autoclave's lid lifts while its container goes in, in metres. */
export const LID_LIFT = 0.3;

/**
 * The autoclave's aluminium inner container, 11-1/8 in across and 8-1/2 in
 * deep. It holds the autoclave bag on the bench and goes into the autoclave
 * with it, so the bag is never lifted out on its own.
 *
 * @see https://www.thomassci.com/p/all-american-50x-25-quart-electric-sterilizer
 */
export const CONTAINER = {
  depth: 0.2159,
  home: [0.33, 0, 0.21],
  radius: 0.141_29,
} as const;

/** The tray the waste waits on at the front of the bench, its floor `floor` above the bench. */
export const TRAY = {
  at: [-0.36, 0, 0.2],
  depth: 0.28,
  floor: 0.004,
  height: 0.03,
  width: 0.4,
} as const;
