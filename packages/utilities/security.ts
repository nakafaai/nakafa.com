const ENCODER = new TextEncoder();

/**
 * Compares two optional strings without returning early on length mismatches.
 */
export function timingSafeEqual(
  provided: string | undefined,
  expected: string | undefined
) {
  if (provided === undefined || expected === undefined) {
    return false;
  }

  const providedBytes = ENCODER.encode(provided);
  const expectedBytes = ENCODER.encode(expected);
  const maxLength = Math.max(providedBytes.length, expectedBytes.length);
  let difference = Math.abs(providedBytes.length - expectedBytes.length);

  for (let index = 0; index < maxLength; index++) {
    difference += Math.abs(
      (providedBytes[index] ?? 0) - (expectedBytes[index] ?? 0)
    );
  }

  return difference === 0;
}
