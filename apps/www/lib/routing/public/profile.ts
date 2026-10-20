import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect } from "effect";
import { hasLocale } from "use-intl";
import { clientEnv } from "@/env.client";
import { readSessionToken } from "@/lib/auth/token";
import { httpLayer } from "@/lib/convex/http";
import { profileHref } from "@/lib/profile/href";
import { isProfileTab } from "@/lib/profile/route";
import { permanentRedirect } from "@/lib/routing/public/redirect";

/** The signed-in account of a request, or null for a visitor. */
const readRequestAccount = Effect.fn("www.routing.publicHtml.profileAccount")(
  function* (headers: Headers) {
    const token = yield* readSessionToken(
      clientEnv.VITE_CONVEX_SITE_URL,
      headers
    );
    if (token === undefined) {
      return null;
    }
    return yield* HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(auth.queries.getCurrentUser, {})),
      Effect.provide(httpLayer({ auth: token }))
    );
  }
);

/**
 * Resolves the retired address of a profile, `/{locale}/user/{id}` and its
 * `chat` tab, to the address of the username that the account holds. The id
 * address is retired for good, so the answer is permanent (308) even though the
 * username it names can change.
 *
 * Only the request of the account itself is sent on: a retired id address is
 * answered for its own account alone. Any other request, and the id of an
 * account that holds no username yet, is no retired address: the path falls to
 * route ownership and is not found, and the answer never tells whether an id
 * exists. A path that is no profile address, and `settings`, the one fixed page
 * below `user`, ask nobody.
 */
export const readProfileRedirect = Effect.fn(
  "www.routing.publicHtml.profileRedirect"
)(function* (pathname: string, headers: Headers) {
  const [locale, root, id, ...tab] = Arr.filter(pathname.split("/"), Boolean);
  if (
    !(
      hasLocale(LOCALES, locale) &&
      root === "user" &&
      id !== undefined &&
      id !== "settings" &&
      isProfileTab(tab)
    )
  ) {
    return null;
  }
  const account = yield* readRequestAccount(headers);
  const username =
    account?.appUser._id === id ? account.appUser.username : undefined;
  return username === undefined
    ? null
    : permanentRedirect(
        `/${locale}${Arr.join([profileHref(username), ...tab], "/")}`
      );
});
