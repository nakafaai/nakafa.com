import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, HashSet } from "effect";

/** The provider error landing path of every active locale. */
const providerErrorRoutePathnames = HashSet.fromIterable(
  Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) => `/${locale}/auth/error`)
);

/**
 * Removes provider-owned diagnostics before the redirect crosses into the app.
 *
 * Better Auth appends `error` and `error_description` to `errorCallbackURL`.
 * The app error landing needs only its validated continuation intent, so every
 * other query value and fragment is discarded at the auth response boundary.
 */
export function sanitizeProviderErrorRedirectResponse(
  response: Response,
  siteUrl: URL
) {
  const rawLocation = response.headers.get("location");
  if (!(rawLocation && response.status >= 300 && response.status < 400)) {
    return;
  }
  if (!URL.canParse(rawLocation, siteUrl)) {
    return;
  }
  const location = new URL(rawLocation, siteUrl);
  if (
    location.origin !== siteUrl.origin ||
    !HashSet.has(providerErrorRoutePathnames, location.pathname)
  ) {
    return;
  }
  const intent = location.searchParams.get("intent");
  location.search = "";
  location.hash = "";
  if (intent !== null) {
    location.searchParams.set("intent", intent);
  }
  const headers = new Headers(response.headers);
  headers.set("location", location.href);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
