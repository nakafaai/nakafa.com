/** The sign that opens the address of a profile: `/@username`. */
export const PROFILE_SIGN = "@";

/** The address of a profile below the locale. Its tabs add a segment. */
export function profileHref(username: string) {
  return `/${PROFILE_SIGN}${username}`;
}
