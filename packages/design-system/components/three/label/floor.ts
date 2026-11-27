/**
 * The smallest size, in CSS pixels, a label of a scene draws at: 14 on a phone,
 * 15 on a card wide enough for a laptop. No lab draws a label under it, so a
 * reader takes in every name of a scene in two seconds at any width.
 */
export const LABEL_FLOOR = {
  narrow: 14,
  wide: 15,
} as const;

/** The canvas width, in CSS pixels, from which a label draws at the wide floor. */
export const LABEL_WIDE_CANVAS = 640;

/**
 * A size a lab may give as a label's least or largest size, in CSS pixels. It
 * starts at the floor, so no lab can type a label smaller than a reader can read.
 */
export type LabelPixels =
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 26
  | 28
  | 30
  | 32;

/** The floor of a label on a canvas this many CSS pixels wide. */
export function labelFloor(canvasWidth: number) {
  return canvasWidth >= LABEL_WIDE_CANVAS
    ? LABEL_FLOOR.wide
    : LABEL_FLOOR.narrow;
}

/**
 * The sizes a label may draw between on a canvas, in CSS pixels. A least size
 * under the floor rises to it, and a largest size under the least rises to the
 * least, so whatever a lab asks for, the label never draws under the floor.
 */
export function labelRange({
  canvasWidth,
  maximum,
  minimum,
}: {
  readonly canvasWidth: number;
  readonly maximum: number;
  readonly minimum: number;
}) {
  const low = Math.max(minimum, labelFloor(canvasWidth));
  return { high: Math.max(maximum, low), low };
}
