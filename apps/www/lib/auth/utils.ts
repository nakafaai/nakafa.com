import { ConvexError } from "convex/values";

const AUTH_ERROR_REGEX = /auth/i;

/**
 * https://labs.convex.dev/better-auth/experimental#jwt-caching
 */
export const isAuthError = (error: unknown) => {
  // This broadly matches potentially auth related errors, can be rewritten to
  // work with your app's own error handling.
  const message =
    (error instanceof ConvexError && error.data) ||
    (error instanceof Error && error.message) ||
    "";
  return AUTH_ERROR_REGEX.test(message);
};
