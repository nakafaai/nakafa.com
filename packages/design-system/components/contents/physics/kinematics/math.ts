import {
  type DecimalSeparator,
  formatKeptZeroNumber,
  formatSignedTrimmedNumber,
  formatTrimmedNumber,
} from "@repo/design-system/components/contents/physics/kinematics/number";

/** An acceleration in m/s^2 with its sign, for example "+2" or "-1.5". */
export function formatAccelerationMath(value: number) {
  return `${formatSignedTrimmedNumber(value)}\\text{ m/s}^2`;
}

/** A distance in meters that keeps the zero tenth: 2.04 prints "2.0 m". */
export function formatKeptZeroMeterMath(value: number) {
  return `${formatKeptZeroNumber(value)}\\text{ m}`;
}

/** A distance in meters with the zero tenth dropped. */
export function formatTrimmedMeterMath(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  return `${formatTrimmedNumber(value, decimalSeparator)}\\text{ m}`;
}

/** A speed in m/s with the zero tenth dropped. */
export function formatTrimmedSpeedMath(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  return `${formatTrimmedNumber(value, decimalSeparator)}\\text{ m/s}`;
}

/** A time in seconds with the zero tenth dropped. */
export function formatTrimmedSecondMath(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  return `${formatTrimmedNumber(value, decimalSeparator)}\\text{ s}`;
}

/** A distance in meters rounded to a whole number. */
export function formatRoundedMeterMath(value: number) {
  return `${Math.round(value)}\\text{ m}`;
}

/** A speed in m/s rounded to a whole number. */
export function formatRoundedSpeedMath(value: number) {
  return `${Math.round(value)}\\text{ m/s}`;
}

/** A speed in m/s rounded to a whole number, with a plus sign when positive. */
export function formatSignedRoundedSpeedMath(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${Math.round(value)}\\text{ m/s}`;
}

/** A time in seconds rounded to a whole number. */
export function formatRoundedSecondMath(value: number) {
  return `${Math.round(value)}\\text{ s}`;
}
