import {
  numeralLength,
  placeDigits,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import type { Point } from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  boxSize,
  bundleSize,
  SINGLE_SIZE,
  SizeSchema,
  traySize,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr, Schema } from "effect";

/**
 * Where each place's things lie on the desk. Every place keeps a zone of its
 * own, left to right from the tray to the loose sticks, as a place-value
 * chart reads. A zone lays its things flat on the desk in a line from its
 * front edge back, far enough apart that each one shows behind the one in
 * front, so the learner counts each place's digit at a glance. Boxes wrap
 * to a second line after four. Bundles that the next round boxes wait in a
 * crib on top of the ones that stay.
 */

/** The front edge of every zone, and the gaps between things in a line, between lines, and between zones. */
const ZONE = { aisle: 0.014, between: 0.035, front: 0.06, gap: 0.004 } as const;

/** How much of a thing's height the gap behind it adds, so the next thing's top shows over it. */
const SIGHT = 0.4;

/** How many boxes stand in one line before the next line starts. */
const BOX_LINE = 4;

/** How deep the crib of waiting bundles runs before it stacks a layer higher. */
const CRIB_DEPTH = 0.12;

/** Where a label in front of a zone stands. */
export const LABEL_Z = ZONE.front + 0.03;

/**
 * One place's zone: the size of its things, how many of them stand in a
 * line front to back, how many lines stand side by side, and the x of its
 * middle.
 */
export const ZoneSchema = Schema.Struct({
  columns: Schema.Int,
  line: Schema.Int,
  size: SizeSchema,
  x: Schema.Finite,
});
type Zone = typeof ZoneSchema.Type;

/** How far apart the things of a line stand, front to back. */
function linePitch(size: typeof SizeSchema.Type) {
  return size.depth + ZONE.gap + SIGHT * size.height;
}

/** The things of `place` in `base`, and how its zone lines them up when the place's digit is `digit`. */
function zoneShape(place: number, base: number, digit: number) {
  if (place === 0) {
    return { columns: 1, line: base - 1, size: SINGLE_SIZE };
  }
  if (place === 1) {
    const size = bundleSize(base);
    const crib = Math.floor(CRIB_DEPTH / linePitch(size));
    return { columns: 1, line: Math.max(base - 1, crib), size };
  }
  if (place === 2) {
    const columns = Math.max(1, Math.ceil(digit / BOX_LINE));
    return { columns, line: BOX_LINE, size: boxSize(base) };
  }
  return { columns: 1, line: 1, size: traySize(base) };
}

/** How wide a zone stands: its lines side by side, with an aisle between them. */
function zoneWidth({ columns, size }: Pick<Zone, "columns" | "size">) {
  return columns * size.length + (columns - 1) * ZONE.aisle;
}

/** The zones of `count` in `base`, one for each digit, loose sticks first, laid side by side round the desk's middle. */
export function deskZones(count: number, base: number): readonly Zone[] {
  const digits = placeDigits(count, base);
  const shapes = Arr.makeBy(numeralLength(count, base), (place) =>
    zoneShape(place, base, Arr.getUnsafe(digits, place))
  );
  const widths = Arr.map(shapes, zoneWidth);
  const total = Arr.reduce(
    widths,
    (shapes.length - 1) * ZONE.between,
    (sum, width) => sum + width
  );
  return Arr.map(shapes, (shape, place) => {
    const left = Arr.reduce(
      Arr.drop(widths, place + 1),
      0,
      (sum, width) => sum + width + ZONE.between
    );
    return { ...shape, x: left + Arr.getUnsafe(widths, place) / 2 - total / 2 };
  });
}

/**
 * The room that `things` things take in a zone, `rise` tall each: its full
 * width, from its front edge back as far as its lines run, and as many
 * layers high as they stack.
 */
export function zoneFootprint(
  zone: Zone,
  things: number,
  rise: number
): CoordinateFrame {
  const half = zoneWidth(zone) / 2;
  const rows = Math.min(things, zone.line);
  const layers = Math.ceil(things / (zone.line * zone.columns));
  return {
    x: { max: zone.x + half, min: zone.x - half },
    y: { max: layers * rise, min: 0 },
    z: { max: ZONE.front, min: ZONE.front - rows * linePitch(zone.size) },
  };
}

/**
 * Where thing `slot` of a zone lies: along a line from the front edge back,
 * then in the next line beside it, then a layer higher, so the first things
 * lie flat at the front and the waiting ones on top.
 */
export function zoneSlot(slot: number, zone: Zone): Point {
  const { columns, line, size, x } = zone;
  const cell = slot % (line * columns);
  const column = Math.floor(cell / line);
  return {
    x: x + (column - (columns - 1) / 2) * (size.length + ZONE.aisle),
    y: Math.floor(slot / (line * columns)) * size.height,
    z: ZONE.front - ((cell % line) + 0.5) * linePitch(size),
  };
}
