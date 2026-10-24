import { String as Str } from "effect";

/** The name of the fragment entry that carries a share token. */
export const SHARE_ENTRY = "share";

/**
 * `hash`, the `location.hash` of a page, without the share token that its
 * fragment carries. A fragment that carries no token comes back as it is, so an
 * anchor such as `#comments` survives.
 *
 * A share link keeps its token in the fragment because a browser sends a
 * fragment to no server. A flow that puts the address of the current page in a
 * request, in a query string to Nakafa or to a payment processor, calls this
 * first, because the token opens a chat and must not reach a log. The language
 * switch keeps the whole fragment in the browser instead.
 */
export function withoutShareToken(hash: string) {
  const entries = new URLSearchParams(Str.slice(1)(hash));
  if (!entries.has(SHARE_ENTRY)) {
    return hash;
  }
  entries.delete(SHARE_ENTRY);
  const rest = entries.toString();
  return rest === "" ? "" : `#${rest}`;
}
