import { matchesSecret } from "@repo/utilities/digest";
import { Effect } from "effect";

const BEARER_PREFIX = "Bearer ";
const TOKEN_WHITESPACE = /\s/u;

/** Extracts one exact bearer value or an empty invalid candidate. */
export function bearerToken(authorization: string) {
  return authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : "";
}

/** Confirms one deployment secret is non-empty and contains no whitespace. */
function isValidSecret(value: string) {
  return value.length > 0 && !TOKEN_WHITESPACE.test(value);
}

/** Timing-safely compares one untrusted candidate with a deployment secret. */
export const matchesHttpSecret = Effect.fn("contentRelease.matchesHttpSecret")(
  function* (candidate: string, secret: string) {
    const matched = yield* matchesSecret(candidate, secret);
    return isValidSecret(candidate) && isValidSecret(secret) && matched;
  }
);
