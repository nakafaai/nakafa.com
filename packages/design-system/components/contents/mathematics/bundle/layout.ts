import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import { Array as Arr, Schema } from "effect";

/**
 * The things on the bundling desk and how they nest, in metres, with the
 * desk top at y = 0, x running left to right and z toward the learner.
 * Sticks lie along x. A position is the bottom middle of the thing placed.
 */

/** A point on or above the desk. */
const PointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Point = typeof PointSchema.Type;

/** A wooden ice-cream stick, as craft packs sell them. */
export const STICK = {
  length: 0.114,
  thickness: 0.002,
  width: 0.0095,
} as const;

/** How far apart sticks lie in a bundle, side by side and one on another. */
const STICK_PITCH = { y: 0.0021, z: 0.0099 } as const;

/** The card of a box and the wood of a tray: wall, floor and the room left round what they hold. */
const BOX = { clearance: 0.003, floor: 0.0012, wall: 0.0012 } as const;
const TRAY = {
  base: 0.005,
  clearance: 0.004,
  rim: 0.008,
  wall: 0.005,
} as const;

/** Where the middle of the heap lies before the sticks are bundled, behind the zones. */
export const HEAP = { x: 0, z: -0.31 } as const;

/** How items pack in a container: columns across z, then layers up. */
const PackSchema = Schema.Struct({ columns: Schema.Int, layers: Schema.Int });
type Pack = typeof PackSchema.Type;

/** A bundle of `base` sticks: at most five sticks high, so it stays a squat bundle. */
export function bundlePack(base: number): Pack {
  const columns = Math.ceil(base / 5);
  return { columns, layers: Math.ceil(base / columns) };
}

/** The size of a thing on the desk: length along x, depth along z, height. */
export const SizeSchema = Schema.Struct({
  depth: Schema.Finite,
  height: Schema.Finite,
  length: Schema.Finite,
});
type Size = typeof SizeSchema.Type;

/** The size of one bundle of `base` sticks. */
export function bundleSize(base: number): Size {
  const { columns, layers } = bundlePack(base);
  return {
    depth: columns * STICK_PITCH.z,
    height: layers * STICK_PITCH.y,
    length: STICK.length,
  };
}

/**
 * `base` bundles in a box: as many columns as make the box's end near
 * square, so a box stays narrow enough to stand beside the others.
 */
export function boxPack(base: number): Pack {
  const bundle = bundleSize(base);
  const columns = Math.max(
    1,
    Math.round(Math.sqrt((base * bundle.height) / bundle.depth))
  );
  return { columns, layers: Math.ceil(base / columns) };
}

/** The outside of an open card box that holds `base` bundles. */
export function boxSize(base: number): Size {
  const bundle = bundleSize(base);
  const { columns, layers } = boxPack(base);
  return {
    depth: columns * (bundle.depth + 0.001) + 2 * BOX.wall + BOX.clearance,
    height: layers * bundle.height + BOX.floor + 0.002,
    length: bundle.length + 2 * BOX.wall + 2 * BOX.clearance,
  };
}

/** The outside of a wooden tray that holds `base` boxes in one row, each in sight. */
export function traySize(base: number): Size {
  const box = boxSize(base);
  return {
    depth: base * (box.depth + 0.002) + 2 * TRAY.wall + TRAY.clearance,
    height: TRAY.base + TRAY.rim,
    length: box.length + 2 * TRAY.wall + 2 * TRAY.clearance,
  };
}

/** Where item `slot` of a pack sits, from the middle of the container's floor. */
function packedAt(slot: number, pack: Pack, size: Size, floor: number): Point {
  const column = slot % pack.columns;
  const layer = Math.floor(slot / pack.columns);
  return {
    x: 0,
    y: floor + layer * size.height,
    z: (column - (pack.columns - 1) / 2) * (size.depth + 0.001),
  };
}

/** Where stick `slot` of a bundle lies, from the bundle's bottom middle. */
export function stickInBundle(slot: number, base: number): Point {
  const { columns } = bundlePack(base);
  return {
    x: 0,
    y: Math.floor(slot / columns) * STICK_PITCH.y,
    z: ((slot % columns) - (columns - 1) / 2) * STICK_PITCH.z,
  };
}

/** Where bundle `slot` lies in its box, from the box's bottom middle. */
export function bundleInBox(slot: number, base: number) {
  return packedAt(slot, boxPack(base), bundleSize(base), BOX.floor);
}

/** Where box `slot` stands in its tray's one row, from the tray's bottom middle. */
export function boxOnTray(slot: number, base: number) {
  const box = boxSize(base);
  return packedAt(
    slot,
    { columns: base, layers: 1 },
    { ...box, depth: box.depth + 0.001 },
    TRAY.base
  );
}

/** The size a loose stick takes in its zone, with room to see each one. */
export const SINGLE_SIZE: Size = {
  depth: STICK.width + 0.003,
  height: STICK.thickness,
  length: STICK.length,
};

/** One stick of the heap: where it lies, how it is turned about the vertical, and how it tips. */
export const HeapStickSchema = Schema.Struct({
  ...PointSchema.fields,
  tilt: Schema.Finite,
  yaw: Schema.Finite,
});
type HeapStick = typeof HeapStickSchema.Type;

/** How far from the heap's middle the middles of `count` sticks fall: a bigger heap spreads wider. */
export function heapRadius(count: number) {
  return 0.02 + 0.0035 * Math.sqrt(count);
}

/**
 * The heap of `count` sticks, tipped out of their pack: each lies at a
 * seeded place in a round heap, turned any way, a little tipped, and higher
 * the later it fell and the nearer the middle, so the heap is a low dome.
 */
export function heapSticks(count: number, seed: number): readonly HeapStick[] {
  const values = seededUniforms(seed, count * 4);
  const radius = heapRadius(count);
  const top = 0.0015 * Math.sqrt(count);
  return Arr.makeBy(count, (stick) => {
    const value = (draw: number) => Arr.getUnsafe(values, stick * 4 + draw);
    const [spread, turn, yaw, tilt] = [value(0), value(1), value(2), value(3)];
    const reach = radius * Math.sqrt(spread);
    const dome = top * (1 - (reach / radius) ** 2);
    return {
      tilt: (tilt - 0.5) * 0.12,
      x: HEAP.x + reach * Math.cos(turn * 2 * Math.PI),
      y: (stick / count) * dome,
      yaw: yaw * Math.PI,
      z: HEAP.z + reach * Math.sin(turn * 2 * Math.PI),
    };
  });
}

/** One flat panel of a box or a tray: its size and where its middle sits from the container's bottom middle. */
const PanelSchema = Schema.Struct({
  at: PointSchema,
  size: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});
export type Panel = typeof PanelSchema.Type;

/** The floor and four walls of an open container of `size`, with walls `wall` thick on a floor `floor` thick and walls `height` tall. */
function openPanels(
  size: Size,
  wall: number,
  floor: number,
  height: number
): readonly Panel[] {
  const { depth, length } = size;
  return [
    { at: { x: 0, y: floor / 2, z: 0 }, size: [length, floor, depth] },
    {
      at: { x: 0, y: height / 2, z: (wall - depth) / 2 },
      size: [length, height, wall],
    },
    {
      at: { x: 0, y: height / 2, z: (depth - wall) / 2 },
      size: [length, height, wall],
    },
    {
      at: { x: (wall - length) / 2, y: height / 2, z: 0 },
      size: [wall, height, depth - 2 * wall],
    },
    {
      at: { x: (length - wall) / 2, y: height / 2, z: 0 },
      size: [wall, height, depth - 2 * wall],
    },
  ];
}

/** The panels of the open card box for `base` bundles. */
export function boxPanels(base: number) {
  const size = boxSize(base);
  return openPanels(size, BOX.wall, BOX.floor, size.height);
}

/** The panels of the wooden tray for `base` boxes. */
export function trayPanels(base: number) {
  const size = traySize(base);
  return openPanels(size, TRAY.wall, TRAY.base, size.height);
}

/**
 * The path of a rubber band round the middle of a bundle of `base` sticks:
 * a rounded rectangle in the y-z plane, hugging the bundle's sides, with
 * `steps` points to a corner.
 */
export function bandPath(base: number, steps: number): readonly Point[] {
  const { depth, height } = bundleSize(base);
  const corner = 0.0012;
  const halfDepth = depth / 2 + 0.0004 - corner;
  const halfHeight = height / 2 + 0.0004 - corner;
  const corners = [
    { y: halfHeight, z: halfDepth, start: 0 },
    { y: -halfHeight, z: halfDepth, start: Math.PI / 2 },
    { y: -halfHeight, z: -halfDepth, start: Math.PI },
    { y: halfHeight, z: -halfDepth, start: (3 * Math.PI) / 2 },
  ];
  return Arr.flatMap(corners, ({ start, y, z }) =>
    Arr.makeBy(steps, (step) => {
      const angle = start + (step / (steps - 1)) * (Math.PI / 2);
      return {
        x: 0,
        y: height / 2 + y + corner * Math.cos(angle),
        z: z + corner * Math.sin(angle),
      };
    })
  );
}
