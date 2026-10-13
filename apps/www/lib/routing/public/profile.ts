import { HttpClient } from "@confect/js";
import users from "@repo/backend/confect/_generated/refs/users";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect } from "effect";
import { hasLocale } from "next-intl";
import { httpLayer } from "@/lib/convex/http";
import { profileHref } from "@/lib/profile/href";
import { isProfileTab } from "@/lib/profile/route";
import { temporaryRedirect } from "@/lib/routing/public/redirect";

/**
 * Resolves the retired address of a profile, `/{locale}/user/{id}` and its
 * `chat` tab, to the address of the username that the account holds. The answer
 * is temporary (307) because a rename moves the successor, and a browser may
 * keep a permanent redirect for good: it would send a visitor to the old
 * username, which a rename frees for someone else. Any other path is no retired
 * address. So is the id of an account that holds no username, and a text that
 * is no id: the path then falls to route ownership. `settings` is the one fixed
 * page below `user`.
 */
export const readProfileRedirect = Effect.fn(
  "www.routing.publicHtml.profileRedirect"
)(function* (pathname: string) {
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
  const username = yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) =>
      client.query(users.queries.getUsernameById, { userId: id })
    ),
    Effect.provide(httpLayer())
  );
  return username === null
    ? null
    : temporaryRedirect(
        `/${locale}${Arr.join([profileHref(username), ...tab], "/")}`
      );
});
