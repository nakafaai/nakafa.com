import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
import type { Locale } from "use-intl";

/** The address of one locale's sign-in page. */
export function signInPath(locale: Locale): string {
  return `/${locale}/auth`;
}

/**
 * The sign-in page of every locale. The build prerenders each one, and the Worker
 * sees these addresses before the static assets do (`runWorkerFirst`), so a
 * request that holds a session reaches the router's gate while a visitor's request
 * gets the prerendered page.
 */
export const SIGN_IN_PATHS = Arr.map(LOCALES, signInPath);

/** Whether a router path names a locale's sign-in page. */
export function isSignInPath(pathname: string): boolean {
  return Arr.contains(SIGN_IN_PATHS, pathname);
}
