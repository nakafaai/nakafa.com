const STABLE_ID_MODULUS = 2_147_483_647;
const STABLE_ID_MULTIPLIER = 31;

/**
 * Clean a slug, remove slash at the beginning and the end
 * @param slug - The slug to clean, example: "/hello/world" -> "hello/world"
 * @returns The cleaned slug
 */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}

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
