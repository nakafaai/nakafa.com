import { Schema } from "effect";

/**
 * Finding the thickness of one sheet of paper with a ruler that resolves
 * only a millimetre. One sheet is far too thin to read, so measure a stack
 * and divide by the number of sheets, an exact count. The stack's reading
 * sets the significant figures: a taller stack gives a reading with more
 * digits, and so a sheet thickness with more digits in its coefficient.
 */

/** One sheet's true thickness, in millimetres. */
export const SHEET_THICKNESS = 0.104;

/** The stacks the lab offers, by number of sheets. */
export const StackSchema = Schema.Literals(["10", "100", "500", "1000"]);

/**
 * The stack of `sheets` read to the nearest millimetre, its significant
 * figures, and one sheet's thickness in metres from it.
 */
export function stackReading(stack: typeof StackSchema.Type) {
  const sheets = Number(stack);
  const height = Math.round(sheets * SHEET_THICKNESS);
  const figures = Math.floor(Math.log10(height)) + 1;
  return { figures, height, sheet: height / sheets / 1000, sheets };
}
