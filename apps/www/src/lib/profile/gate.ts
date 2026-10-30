import { decodeLocale } from "@repo/internationalization/src/locale";
import { Option } from "effect";
import { PROFILE_ROUTE_SEGMENT, SETTINGS_SEGMENT } from "@/lib/profile/href";

/**
 * Whether a request names a raw address `/{locale}/user/{name}`, a tab or a
 * Markdown spelling of it included, other than the settings page. A profile has
 * no address below `user`: it lives at `/{locale}/@{username}`, which the
 * profile rewrite maps to the router. A learner's own retired id address is
 * redirected to its username before this gate runs, so every raw address that
 * reaches it answers the static not-found page, and the router, which would move
 * the raw spelling to its `@` spelling first, never sees it.
 */
export function isRawProfileAddress(request: Request): boolean {
  const [, localeSegment, root = "", name = ""] = new URL(
    request.url
  ).pathname.split("/");
  return (
    root === PROFILE_ROUTE_SEGMENT &&
    name !== "" &&
    name !== SETTINGS_SEGMENT &&
    Option.isSome(decodeLocale(localeSegment))
  );
}
