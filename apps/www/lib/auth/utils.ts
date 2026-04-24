import { ConvexError } from "convex/values";

const AUTH_ERROR_REGEX = /auth/i;

/** Extract one lower-level auth error string from unknown Better Auth / Convex errors. */
function getAuthErrorText(error: unknown) {
  if (error instanceof ConvexError) {
    const data = error.data;

    if (typeof data === "string") {
      return data;
    }

    if (typeof data === "object" && data !== null) {
      if ("code" in data && typeof data.code === "string") {
        return data.code;
      }

      if ("message" in data && typeof data.message === "string") {
        return data.message;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}

/** Returns one safe internal app path that can be reused as a redirect target. */
export function getSafeInternalRedirectPath(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

/**
 * https://labs.convex.dev/better-auth/experimental#jwt-caching
 */
export const isAuthError = (error: unknown) => {
  const message = getAuthErrorText(error);

  return AUTH_ERROR_REGEX.test(message);
};
