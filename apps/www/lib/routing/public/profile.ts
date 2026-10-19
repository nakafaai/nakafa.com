import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option } from "effect";
import { hasLocale } from "use-intl";
import { clientEnv } from "@/env.client";
import { readSessionToken } from "@/lib/auth/token";
import { httpLayer } from "@/lib/convex/http";
import { profileHref } from "@/lib/profile/href";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";
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
 * Decides, before the page renders, whether an address of a profile,
 * `/{locale}/@username` and its tabs, is not found: a username that nobody
 * holds, or the Chat tab of a profile that the request's account does not hold.
 * Anyone may open a profile and its Posts and Comments (`readProfile` reads it),
 * and its chats are its owner's alone. Such an address is answered here, with the
 * app's not-found page and a 404 status, so the page never starts a stream that
 * it would have to end as not found. The answer is the locale of that page, or
 * null when the path is no profile address or the request may open it.
 */
export const readProfileRefusal = Effect.fn(
  "www.routing.publicHtml.profileRefusal"
)(function* (pathname: string, headers: Headers) {
  const [locale, root, ...tab] = Arr.filter(pathname.split("/"), Boolean);
  if (
    !(hasLocale(LOCALES, locale) && root !== undefined && isProfileTab(tab))
  ) {
    return null;
  }
  const username = readProfileRoot(root);
  if (Option.isNone(username)) {
    return null;
  }
  const profile = yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) =>
      client.query(users.queries.getProfileByUsername, {
        username: username.value,
      })
    ),
    Effect.provide(httpLayer())
  );
  if (profile === null) {
    return locale;
  }
  if (tab[0] !== "chat") {
    return null;
  }
  const account = yield* readRequestAccount(headers);
  return account?.appUser.username === profile.username ? null : locale;
});

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
