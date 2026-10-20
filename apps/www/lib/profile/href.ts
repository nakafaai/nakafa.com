import { Schema } from "effect";

/** The sign that opens the address of a profile: `/@username`. */
export const PROFILE_SIGN = "@";

/**
 * The router's segment that holds every profile, `/{locale}/user/{username}`. A
 * browser never asks for this address: the profile rewrite maps `@username` to it.
 */
export const PROFILE_ROUTE_SEGMENT = "user";

/** The one fixed page below the profile segment, which names no profile. */
export const SETTINGS_SEGMENT = "settings";

/**
 * The tabs a profile adds below its address, each as one segment after the
 * username. Posts is the address itself. The route check, the rewrites and the
 * tabs all read this one list, so a tab added here is routed and shown alike.
 */
export const ProfileTab = Schema.Literals(["comments", "chat"]);

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
