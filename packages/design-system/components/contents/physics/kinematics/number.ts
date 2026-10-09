/** The symbol a formatted number uses for its decimal point. */
export type DecimalSeparator = "comma" | "dot";

const TRAILING_ZERO_PATTERN = /\.0$/;

/**
 * Keeps the zero tenth: whole numbers print as written, and other values print
 * with one decimal, so 2.04 prints "2.0".
 */
export function formatKeptZeroNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * A signed number that keeps the zero tenth: a positive value gets a plus sign,
 * and a negative value keeps its minus sign.
 */
export function formatSignedKeptZeroNumber(value: number) {
  return value > 0
    ? `+${formatKeptZeroNumber(value)}`
    : formatKeptZeroNumber(value);
}

/**
 * Drops the zero tenth: a value prints with one decimal minus a trailing zero,
 * so 2.04 prints "2". A comma separator writes the decimal point as "{,}".
 */
export function formatTrimmedNumber(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  const trimmed = value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");

  if (decimalSeparator === "comma") {
    return trimmed.replace(".", "{,}");
  }

  return trimmed;
}

/**
 * A signed trimmed number: zero prints "0", a positive value gets a plus sign,
 * and a negative value keeps its minus sign.
 */
export function formatSignedTrimmedNumber(value: number) {
  if (value === 0) {
    return "0";
  }

  if (value > 0) {
    return `+${formatTrimmedNumber(value)}`;
  }

  return formatTrimmedNumber(value);
}
