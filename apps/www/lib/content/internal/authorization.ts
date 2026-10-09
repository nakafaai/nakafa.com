import { matchesSecret } from "@repo/utilities/digest";
import { Effect } from "effect";

const BEARER_PREFIX = "Bearer ";

/**
 * Authenticates one internal content request with a timing-safe bearer check.
 * A failed digest is a defect, as a thrown digest was before: the route fails
 * with a server error and never answers "not authorized".
 */
export const isInternalContentAuthorized = Effect.fn(
  "NakafaContent.isInternalContentAuthorized"
)(function* (authorization: string | null, expectedToken: string) {
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const providedToken = authorization.slice(BEARER_PREFIX.length);
  if (!providedToken) {
    return false;
  }

  return yield* matchesSecret(providedToken, expectedToken).pipe(Effect.orDie);
});
