import { timingSafeEqual } from "@repo/utilities/security";

const BEARER_PREFIX = "Bearer ";

/** Authenticates one internal content request with a timing-safe bearer check. */
export function isInternalContentAuthorized(
  authorization: string | null,
  expectedToken: string
) {
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const providedToken = authorization.slice(BEARER_PREFIX.length);
  if (!providedToken) {
    return false;
  }

  return timingSafeEqual(providedToken, expectedToken);
}
