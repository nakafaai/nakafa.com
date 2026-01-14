import { Effect } from "effect";

/**
 * Timing-safe string comparison to prevent timing attacks.
 *
 * Compares two strings in constant time regardless of content,
 * which prevents attackers from discovering the key length or
 * partial matches through timing measurements.
 *
 * @param a - First string to compare (e.g., provided API key)
 * @param b - Second string to compare (e.g., valid API key)
 * @returns Effect that resolves to true if strings are identical
 */
export function timingSafeEqual(
  a: string | undefined,
  b: string | undefined
): Effect.Effect<boolean, never> {
  return Effect.sync(() => {
    if (a === undefined || b === undefined) {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    const encoder = new TextEncoder();
    const aBuffer = encoder.encode(a);
    const bBuffer = encoder.encode(b);

    let result = 0;
    for (let i = 0; i < aBuffer.length; i++) {
      result += aBuffer[i] !== bBuffer[i] ? 1 : 0;
    }

    return result === 0;
  });
}
