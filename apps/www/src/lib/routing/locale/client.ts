import { useNavigate } from "@tanstack/react-router";
import { Data, Effect } from "effect";
import { useTransition } from "react";
import type { Locale } from "use-intl";

/** Raised when the browser cannot load the language-switch request module. */
class LocalizedHrefModuleError extends Data.TaggedError(
  "LocalizedHrefModuleError"
)<{
  cause: unknown;
}> {}
/** Reads the browser location without keeping stale React state around. */
function readCurrentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
/**
 * Loads the request module when a visitor picks a language. It carries the
 * HTTP client, so a static import would add that client to the first
 * JavaScript of every page, which
 * `apps/www/e2e/budget/javascript.browser.ts` budgets.
 */
const loadLocalizedHrefRequest = Effect.tryPromise({
  catch: (cause) => new LocalizedHrefModuleError({ cause }),
  try: () => import("@/lib/routing/locale/request"),
});
/**
 * Drives locale switches through the route-owned localization API instead of
 * preserving localized slug text across languages. The server decides the
 * address of the page in the chosen locale, so the router takes that address
 * as an href.
 */
export function useLocalizedRouteSwitch() {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  function replace(locale: Locale) {
    startTransition(() => {
      Effect.runPromise(
        loadLocalizedHrefRequest.pipe(
          Effect.flatMap(({ requestLocalizedHref }) =>
            requestLocalizedHref({ href: readCurrentHref(), locale })
          ),
          Effect.tap(({ href }) =>
            Effect.sync(() => {
              navigate({ href, replace: true });
            })
          ),
          Effect.catch(() => Effect.void)
        )
      );
    });
  }
  return { isPending, replace };
}
