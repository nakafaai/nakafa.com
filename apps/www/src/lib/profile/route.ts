import { readUsername } from "@repo/backend/confect/users/username";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Result, Schema, String as Str } from "effect";
import { hasLocale } from "use-intl/core";
import { PROFILE_SIGN, ProfileTab } from "@/lib/profile/href";

/** Whether the segments below a profile name one of its tabs: none, which is Posts, or one of `ProfileTab`. */
export function isProfileTab(segments: readonly string[]) {
  return (
    segments.length === 0 ||
    (segments.length === 1 && Schema.is(ProfileTab)(segments[0]))
  );
}

/**
 * Reads a retired id address of a profile, `/{locale}/user/{id}` with its tab: the
 * locale, the id and the tab. The settings page below `user` is no profile, and
 * any other path reads as none.
 */
export function readProfileIdAddress(pathname: string) {
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
    return Option.none();
  }
  return Option.some({ id, locale, tab });
}

/** Reads the username from the first segment of an address, such as `@nabilfatih`. */
export function readProfileRoot(root: string) {
  return Str.startsWith(PROFILE_SIGN)(root)
    ? Result.getSuccess(readUsername(Str.slice(PROFILE_SIGN.length)(root)))
    : Option.none();
}
