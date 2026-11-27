import { Array as Arr } from "effect";

/**
 * The seven-segment figures of a liquid-crystal display, as a stopwatch
 * shows its time: which segments each figure darkens, where the seven bars
 * of one figure lie, and which figure stands at each place of a time.
 */

/** How many segments one figure has. */
export const SEGMENTS = 7;

/** How many figures a time is shown in: minutes, tens of seconds, seconds, tenths, hundredths. */
export const PLACES = 5;

/**
 * The segments each figure from 0 to 9 darkens, one bit each from the high
 * bit down: top, upper right, lower right, bottom, lower left, upper left,
 * middle.
 */
const DARK = [
  0b111_1110, 0b011_0000, 0b110_1101, 0b111_1001, 0b011_0011, 0b101_1011,
  0b101_1111, 0b111_0000, 0b111_1111, 0b111_1011,
];

/** Whether a figure darkens one of its segments. */
export function segmentLit(figure: number, segment: number) {
  const shifted = Arr.getUnsafe(DARK, figure) / 2 ** (SEGMENTS - 1 - segment);
  return Math.floor(shifted) % 2 === 1;
}

/**
 * The figure at one place of a time in seconds, read to its hundredth:
 * place 0 is the minutes, 1 the tens of seconds, 2 the seconds, 3 the
 * tenths and 4 the hundredths.
 */
export function clockFigure(seconds: number, place: number) {
  const hundredths = Math.round(seconds * 100);
  if (place === 0) {
    return Math.floor(hundredths / 6000) % 10;
  }
  return Math.floor((hundredths % 6000) / 10 ** (PLACES - 1 - place)) % 10;
}

/**
 * The seven bars of one figure `wide` by `tall` drawn with strokes `thick`
 * wide, about its middle: where each bar's middle lies and its size across
 * and up, in the order `segmentLit` counts them.
 */
export function segmentBars(figure: {
  readonly tall: number;
  readonly thick: number;
  readonly wide: number;
}) {
  const { tall, thick, wide } = figure;
  const across = [wide - thick * 1.5, thick] as const;
  const up = [thick, tall / 2 - thick * 1.25] as const;
  const side = wide / 2 - thick / 2;
  const half = tall / 4;
  return [
    { at: [0, tall / 2 - thick / 2], size: across },
    { at: [side, half], size: up },
    { at: [side, -half], size: up },
    { at: [0, -tall / 2 + thick / 2], size: across },
    { at: [-side, -half], size: up },
    { at: [-side, half], size: up },
    { at: [0, 0], size: across },
  ] as const;
}
