import {
  createHash,
  timingSafeEqual as cryptoTimingSafeEqual,
} from "node:crypto";

const SECRET_DIGEST_ALGORITHM = "sha256";

/**
 * Hashes one secret string to a fixed-length digest for safe comparison.
 */
function digestSecret(value: string) {
  return createHash(SECRET_DIGEST_ALGORITHM).update(value, "utf8").digest();
}

/**
 * Compares two optional server-side secret strings with Node's crypto primitive.
 */
export function timingSafeEqual(
  provided: string | undefined,
  expected: string | undefined
) {
  if (provided === undefined || expected === undefined) {
    return false;
  }

  return cryptoTimingSafeEqual(digestSecret(provided), digestSecret(expected));
}
