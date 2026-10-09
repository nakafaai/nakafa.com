import { matchesSecret } from "@repo/utilities/digest";
import { Effect, Schema } from "effect";

const BEARER_PREFIX = "Bearer ";
const TOKEN_WHITESPACE = /\s/u;

/** Web Crypto could not derive one fixed-width secret comparison input. */
export class HttpSecretError extends Schema.TaggedError<HttpSecretError>()(
  "HttpSecretError",
  {}
) {}

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
    const matched = yield* matchesSecret(candidate, secret).pipe(
      Effect.mapError(() => new HttpSecretError())
    );
    return isValidSecret(candidate) && isValidSecret(secret) && matched;
  }
);
