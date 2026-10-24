const ENCODER = new TextEncoder();

/**
 * Compares two secrets without stopping at the first different byte, so the
 * time a wrong guess takes does not reveal how much of the key it matched.
 * Only the lengths of the two values decide early.
 */
export function sameSecret(expected: string, presented: string): boolean {
  const left = ENCODER.encode(expected);
  const right = ENCODER.encode(presented);
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (const [index, byte] of left.entries()) {
    // biome-ignore lint/suspicious/noBitwiseOperators: a constant-time compare must combine every byte with XOR and OR, so no branch depends on a secret byte.
    difference |= byte ^ right[index];
  }
  return difference === 0;
}

/** Whether an Authorization header carries the bearer token of the configured key. */
export function isAuthorized(
  authorization: string | null,
  expected: string
): boolean {
  return (
    authorization !== null && sameSecret(`Bearer ${expected}`, authorization)
  );
}
