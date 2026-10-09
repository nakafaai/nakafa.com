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
 * Drops the zero tenth: whole numbers print as written, and other values print
 * with one decimal minus a trailing zero, so 2.04 prints "2". A comma separator
 * writes the decimal point as "{,}".
 */
export function formatTrimmedNumber(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  const rounded = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");

  if (decimalSeparator === "comma") {
    return rounded.replace(".", "{,}");
  }

  return rounded;
}

/**
 * Drops the zero tenth from every value, whole numbers included, after
 * toFixed(1). Above 2 ** 53 it prints the exact binary value: 2 ** 60 prints
 * "1152921504606846976" here, where formatTrimmedNumber prints the shortest
 * form "1152921504606847000".
 */
export function formatTrimmedFixedNumber(
  value: number,
  decimalSeparator?: DecimalSeparator
) {
  const formatted = value.toFixed(1).replace(TRAILING_ZERO_PATTERN, "");

  if (decimalSeparator === "comma") {
    return formatted.replace(".", "{,}");
  }

  return formatted;
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
