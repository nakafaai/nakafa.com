import { routing } from "@repo/internationalization/src/routing";
import { ConvexError } from "convex/values";

const AUTH_ERROR_REGEX = /auth/i;
const PATH_QUERY_MARKER_REGEX = /[?#]/;
const APP_HOME_PATH = "/home";
const ROOT_PATH = "/";

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

/** Returns a supported locale without widening the locale source of truth. */
function getSupportedLocale(locale: string | null | undefined) {
  return (
    routing.locales.find((currentLocale) => currentLocale === locale) ?? null
  );
}

/** Returns the locale encoded by a localized public marketing homepage path. */
function getMarketingRootLocale(pathname: string) {
  if (pathname === ROOT_PATH) {
    return null;
  }

  const locale = pathname.endsWith(ROOT_PATH)
    ? pathname.slice(1, -1)
    : pathname.slice(1);

  return getSupportedLocale(locale);
}

/** Returns only the pathname portion from one already-safe internal path. */
function getInternalPathname(path: string) {
  const queryIndex = path.search(PATH_QUERY_MARKER_REGEX);

  if (queryIndex === -1) {
    return path;
  }

  return path.slice(0, queryIndex);
}

/** Returns the app home for one supported locale, or the locale-less app home. */
function getAppHomePath(locale: string | null | undefined) {
  const supportedLocale = getSupportedLocale(locale);

  if (!supportedLocale) {
    return APP_HOME_PATH;
  }

  return `/${supportedLocale}${APP_HOME_PATH}`;
}

/** Resolves the post-login callback without sending users back to marketing pages. */
export function getAuthCallbackPath(
  value: string | null | undefined,
  locale?: string | null
) {
  const safePath = getSafeInternalRedirectPath(value);

  if (!safePath) {
    return getAppHomePath(locale);
  }

  const pathname = getInternalPathname(safePath);
  const marketingRootLocale = getMarketingRootLocale(pathname);

  if (pathname !== ROOT_PATH && !marketingRootLocale) {
    return safePath;
  }

  return getAppHomePath(marketingRootLocale ?? locale);
}

/**
 * https://labs.convex.dev/better-auth/experimental#jwt-caching
 */
export const isAuthError = (error: unknown) => {
  const message = getAuthErrorText(error);

  return AUTH_ERROR_REGEX.test(message);
};
