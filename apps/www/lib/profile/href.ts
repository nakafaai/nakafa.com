/** The sign that opens the address of a profile: `/@username`. */
export const PROFILE_SIGN = "@";

/** The address of a profile below the locale. Its tabs add a segment. */
export function profileHref(username: string) {
  return `/${PROFILE_SIGN}${username}`;
}

/**
 * Where a person goes to see their own chats: the chat tab of their profile, or
 * the page of a new chat while the account holds no username. The schema keeps
 * `username` optional, and an account made before usernames has none until the
 * migration names it, so it has no profile address to go to.
 */
export function ownChatsHref(username: string | undefined) {
  return username === undefined ? "/chat" : `${profileHref(username)}/chat`;
}
