/** A color as its sRGB channels, each from 0 to 255. */
export type Rgb = readonly [number, number, number];

/** The WCAG AA contrast normal text needs against what stands behind it. */
export const LABEL_CONTRAST = 4.5;

/**
 * The WCAG AAA contrast an ink that falls short is moved to. A label is small
 * text over a moving scene, so an ink that has to change changes enough to read
 * at a glance, not just enough to pass.
 */
export const LABEL_MOVED_CONTRAST = 7;

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** Steps of the search for the least change of an ink: far finer than one channel step. */
const SEARCH_STEPS = 24;

/** Turns one sRGB channel into linear light. */
function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** The WCAG relative luminance of a color, from 0 for black to 1 for white. */
export function relativeLuminance([red, green, blue]: Rgb) {
  return (
    0.2126 * linearChannel(red) +
    0.7152 * linearChannel(green) +
    0.0722 * linearChannel(blue)
  );
}

/** The WCAG 2.1 contrast ratio of two colors, from 1 to 21. */
export function contrastRatio(first: Rgb, second: Rgb) {
  const one = relativeLuminance(first);
  const two = relativeLuminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/** A color part of the way from one color to another, rounded to whole channels. */
function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

/**
 * The ink a label draws in against its backing: the ink itself when it already
 * reaches `LABEL_CONTRAST`, otherwise the same hue moved the least way toward
 * black on a light backing or toward white on a dark one until it reaches
 * `LABEL_MOVED_CONTRAST`. So the
 * reactant's blue stays blue, a deep blue on a white card and a pale blue on a
 * dark one, and a fixed dark ink turns light on a dark card.
 */
export function readableInk(ink: Rgb, backing: Rgb): Rgb {
  if (contrastRatio(ink, backing) >= LABEL_CONTRAST) {
    return ink;
  }
  const toward =
    contrastRatio(BLACK, backing) >= contrastRatio(WHITE, backing)
      ? BLACK
      : WHITE;
  let low = 0;
  let high = 1;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (
      contrastRatio(mix(ink, toward, middle), backing) >= LABEL_MOVED_CONTRAST
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return mix(ink, toward, high);
}
