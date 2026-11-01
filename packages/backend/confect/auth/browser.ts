/**
 * How a browser's Convex client keeps its session's token. The player and the load test's
 * students both use these, so a load test measures the tokens a real tab asks for.
 */
export const CONVEX_TOKEN_OPTIONS = {
  /**
   * How long before a session's Convex token expires the client asks for the next
   * one, in seconds. The token lives fifteen minutes. Chrome wakes the timers of a
   * tab hidden for five minutes only once a minute, so the client's own ten seconds
   * let the token expire first: Convex then runs the page's queries without an
   * identity, each one refuses with SessionRequired, and only then does the late
   * refresh arrive. Two minutes leave a minute after the latest wake-up, which is
   * also room to ask again when a token request fails.
   * https://developer.chrome.com/blog/timer-throttling-in-chrome-88
   */
  authRefreshTokenLeewaySeconds: 120,
  /**
   * The tab keeps its first token until the refresh above. Without this the client
   * asks for a second token as soon as Convex confirms the first, asks once more at
   * every reconnect until that answer arrives, and ignores all but the newest answer.
   * Under overload that queues one token request for each reconnect.
   */
  initialAuthTokenReuse: true,
};
