import {
  readingFigures,
  resolve,
} from "@repo/design-system/components/contents/physics/measurement/figures";
import { Schema } from "effect";

/**
 * One steel rod read with three instruments. A tape measure resolves whole
 * centimetres, a steel ruler millimetres, and a long vernier caliper tenths
 * of a millimetre, so the same rod reads 31 cm, 31.0 cm or 31.00 cm: each
 * finer instrument adds a measured zero. Writing the reading in metres adds
 * zeros in front that only place the decimal point, and writing a tape
 * reading in millimetres adds a zero at the end that nobody measured.
 */

/** The rod's true length, in centimetres. */
export const ROD_LENGTH = 31.004;

/** The instruments, each with the smallest step it resolves, in centimetres. */
export const RodToolSchema = Schema.Literals(["tape", "ruler", "caliper"]);
export const ROD_TOOLS = {
  caliper: 0.01,
  ruler: 0.1,
  tape: 1,
} as const satisfies Record<typeof RodToolSchema.Type, number>;

/** The units a reading is written in, each as the power of ten one centimetre is in it. */
export const RodUnitSchema = Schema.Literals(["mm", "cm", "m"]);
const ROD_UNITS = { cm: 0, m: -2, mm: 1 } as const satisfies Record<
  typeof RodUnitSchema.Type,
  number
>;

/** How many zeros a string of digits holds. */
function zeroCount(digits: string) {
  let zeros = 0;
  for (const digit of digits) {
    zeros += digit === "0" ? 1 : 0;
  }
  return zeros;
}

/**
 * The reading of the rod with `tool`, written in `unit`: its value, the
 * decimals it is written with, how many significant figures it carries, how
 * many of those are measured zeros, and how many zeros only hold place value,
 * in front of the first digit or after the last measured one.
 */
export function rodReading(
  tool: typeof RodToolSchema.Type,
  unit: typeof RodUnitSchema.Type
) {
  const resolution = ROD_TOOLS[tool];
  const centimetres = resolve(ROD_LENGTH, resolution);
  const shift = ROD_UNITS[unit];
  const written = Math.round(-Math.log10(resolution)) - shift;
  const value =
    shift < 0 ? centimetres / 10 ** -shift : centimetres * 10 ** shift;
  return {
    decimals: Math.max(written, 0),
    figures: readingFigures(centimetres, resolution),
    measuredZeros: zeroCount(`${Math.round(centimetres / resolution)}`),
    placeZeros:
      Math.max(-Math.floor(Math.log10(value)), 0) + Math.max(-written, 0),
    value,
  };
}
