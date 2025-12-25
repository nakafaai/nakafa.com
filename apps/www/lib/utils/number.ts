const NUMBER_REGEX = /^[+-]?\d*\.?\d+$/;

export function parseNumber(value: string): number | null {
  if (!NUMBER_REGEX.test(value)) {
    return null;
  }
  return Number(value);
}

export function isNumber(value: string): boolean {
  return parseNumber(value) !== null;
}
