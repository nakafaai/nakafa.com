import { ConvexError } from "convex/values";

const AUTH_ERROR_REGEX = /auth/i;

/** Returns one safe internal app path that can be reused as a redirect target. */
export function getSafeInternalRedirectPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes(",")) {
    return null;
  }

  return value;
}

/**
 * https://labs.convex.dev/better-auth/experimental#jwt-caching
 */
export const isAuthError = (error: unknown) => {
  const message =
    (error instanceof ConvexError && error.data) ||
    (error instanceof Error && error.message) ||
    "";

  return AUTH_ERROR_REGEX.test(message);
};
