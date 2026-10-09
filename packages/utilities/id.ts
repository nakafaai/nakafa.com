const STABLE_ID_MODULUS = 2_147_483_647;
const STABLE_ID_MULTIPLIER = 31;

/**
 * Create a deterministic short id from a prefix and payload.
 *
 * Use this for render-stable ids that must stay the same for identical input.
 * It is not a security hash and should not be used for user-visible tokens.
 */
export function createStableId(prefix: string, value: string) {
  let hash = 0;

  for (const character of value) {
    hash =
      (hash * STABLE_ID_MULTIPLIER + character.charCodeAt(0)) %
      STABLE_ID_MODULUS;
  }

  return `${prefix}-${hash.toString(36)}`;
}
