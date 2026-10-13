import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect } from "effect";
import { hasLocale } from "next-intl";
import { clientEnv } from "@/env.client";
import { readSessionToken } from "@/lib/auth/token";
import { httpLayer } from "@/lib/convex/http";
import { profileHref } from "@/lib/profile/href";
import { isProfileTab } from "@/lib/profile/route";
import { permanentRedirect } from "@/lib/routing/public/redirect";

/**
 * Resolves the retired address of a profile, `/{locale}/user/{id}` and its
 * `chat` tab, to the address of the username that the account holds. The id
 * address is retired for good, so the answer is permanent (308) even though the
 * username it names can change.
 *
 * Only the account itself opens its profile (see `readProfile`), so only a
 * request that carries the session of the account in the path is sent on. Any
 * other request, and the id of an account that holds no username yet, is no
 * retired address: the path falls to route ownership and is not found, and the
 * answer never tells whether an id exists. A path that is no profile address,
 * and `settings`, the one fixed page below `user`, ask nobody.
 */
export const readProfileRedirect = Effect.fn(
  "www.routing.publicHtml.profileRedirect"
)(function* (pathname: string, headers: Headers) {
  const [locale, root, id, ...tab] = Arr.filter(pathname.split("/"), Boolean);
  if (
    !(
      hasLocale(routing.locales, locale) &&
      root === "user" &&
      id !== undefined &&
      id !== "settings" &&
      isProfileTab(tab)
    )
  ) {
    return null;
  }
  const token = yield* readSessionToken(
    clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
    headers
  );
  if (token === undefined) {
    return null;
  }
  const account = yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(auth.queries.getCurrentUser, {})),
    Effect.provide(httpLayer({ auth: token }))
  );
  const username =
    account?.appUser._id === id ? account.appUser.username : undefined;
  return username === undefined
    ? null
    : permanentRedirect(
        `/${locale}${Arr.join([profileHref(username), ...tab], "/")}`
      );
});
