import { Array as Arr, Option, Record, Schema } from "effect";

/**
 * The readouts of the journey lab as KaTeX: a moment, a distance, where two
 * travellers meet, and the speed of a leg or of the whole journey worked out
 * as distance over time. Numbers come through the reader's locale formatter
 * and units through the lesson, so nothing here is written in one language.
 */

/** The units the lesson writes as plain text, such as "km", "min" and "km/h". */
const UnitsSchema = Schema.Struct({
  distance: Schema.String,
  speed: Schema.String,
  time: Schema.String,
});
export type Units = typeof UnitsSchema.Type;

/** Writes a number and its unit in the reader's locale, with at most `digits` decimals. */
type Quantity = (value: number, unit: string, digits?: number) => string;

/** How many decimals a readout keeps. */
const DIGITS = 1;

/** The characters text mode in KaTeX reads as commands, each with what writes it as itself. */
const SPECIAL: Readonly<Record<string, string>> = {
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  "\\": "\\textbackslash{}",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
};

/** A unit the lesson writes, set as text after a number, so "km/h" reads as written. */
export function unitTex(unit: string) {
  const text = Arr.join(
    Arr.map(Arr.fromIterable(unit), (character) =>
      Option.getOrElse(Record.get(SPECIAL, character), () => character)
    ),
    ""
  );
  return `\\text{ ${text}}`;
}

/** "=" when `value` shows exactly with `DIGITS` decimals, and "≈" when the readout rounds it. */
function equals(value: number) {
  const shown = Math.round(value * 10 ** DIGITS) / 10 ** DIGITS;
  return Math.abs(shown - value) < 1e-9 ? "=" : "\\approx";
}

/** A moment of the journey: "t = 25 min". */
export function momentTex(minute: number, units: Units, quantity: Quantity) {
  return `t ${equals(minute)} ${quantity(minute, unitTex(units.time), DIGITS)}`;
}

/** A distance from the start: "d = 12 km". */
export function placeTex(km: number, units: Units, quantity: Quantity) {
  return `d ${equals(km)} ${quantity(km, unitTex(units.distance), DIGITS)}`;
}

/**
 * Where two travellers meet: "t = 30 min, d = 15 km". Each half is one
 * group, the comma and its space ending the first, so a narrow footer wraps
 * only after the comma, never inside a half, and the second line starts flush.
 */
export function meetingTex(
  meeting: { readonly distance: number; readonly minute: number },
  units: Units,
  quantity: Quantity
) {
  return `{${momentTex(meeting.minute, units, quantity)},\\;}\\allowbreak{${placeTex(meeting.distance, units, quantity)}}`;
}

/**
 * A speed worked out as distance over time, "12 km over 15 min = 48 km/h",
 * in kilometres an hour from a time in minutes. Without `show`, as in a
 * question that asks for the speed, the result is a question mark.
 */
export function rateTex(
  rate: {
    readonly distance: number;
    readonly minutes: number;
    readonly speed: number;
  },
  units: Units,
  quantity: Quantity,
  show: boolean
) {
  const fraction = `\\dfrac{${quantity(rate.distance, unitTex(units.distance), DIGITS)}}{${quantity(rate.minutes, unitTex(units.time), DIGITS)}}`;
  return show
    ? `${fraction} ${equals(rate.speed)} ${quantity(rate.speed, unitTex(units.speed), DIGITS)}`
    : `${fraction} = \\;?`;
}
