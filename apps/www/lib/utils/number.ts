const NUMBER_REGEX = /^[+-]?\d*\.?\d+$/;

/**
 * Parse a string into a number. Returns null if the string is not a number.
 */
export function parseNumber(value: string): number | null {
  if (!NUMBER_REGEX.test(value)) {
    return null;
  }
  return Number(value);
}

/**
 * Check if a string is a number.
 */
export function isNumber(value: string): boolean {
  return parseNumber(value) !== null;
}
