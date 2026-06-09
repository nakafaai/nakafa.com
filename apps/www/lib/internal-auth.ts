import { Effect } from "effect";

/**
 * Compares bearer tokens in constant time for internal API route handlers.
 */
export function timingSafeEqual(
  provided: string | undefined,
  expected: string | undefined
): Effect.Effect<boolean, never> {
  return Effect.sync(() => {
    if (provided === undefined || expected === undefined) {
      return false;
    }

    if (provided.length !== expected.length) {
      return false;
    }

    const encoder = new TextEncoder();
    const providedBuffer = encoder.encode(provided);
    const expectedBuffer = encoder.encode(expected);

    let difference = 0;
    for (let index = 0; index < providedBuffer.length; index++) {
      difference += providedBuffer[index] === expectedBuffer[index] ? 0 : 1;
    }

    return difference === 0;
  });
}
