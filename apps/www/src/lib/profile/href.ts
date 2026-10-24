import { linkOptions } from "@tanstack/react-router";
import { Match, Schema } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

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

/** The public address of a profile below the locale, for canonical links and shares. */
export function profileHref(username: string) {
  return `/${PROFILE_SIGN}${username}`;
}

/** The route of a profile's posts, which the router matches as `/{locale}/user/{username}`. */
export function profileTarget(username: string): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { username },
    to: "/$locale/user/$username",
  });
}

/** The route of one tab of a profile: its chat or its comments. */
export function profileTabTarget(
  tab: typeof ProfileTab.Type,
  username: string
): LinkTarget {
  return Match.value(tab).pipe(
    Match.when("chat", () =>
      linkOptions({
        from: LOCALE_ROUTE,
        params: { username },
        to: "/$locale/user/$username/chat",
      })
    ),
    Match.when("comments", () =>
      linkOptions({
        from: LOCALE_ROUTE,
        params: { username },
        to: "/$locale/user/$username/comments",
      })
    ),
    Match.exhaustive
  );
}

/**
 * Where a person goes to see their own chats: the chat tab of their profile, or
 * the page of a new chat while the account holds no username. The schema keeps
 * `username` optional, and an account made before usernames has none until the
 * migration names it, so it has no profile address to go to.
 */
export function ownChatsTarget(username: string | undefined): LinkTarget {
  return username === undefined
    ? linkOptions({ from: LOCALE_ROUTE, to: "/$locale/chat" })
    : profileTabTarget("chat", username);
}
