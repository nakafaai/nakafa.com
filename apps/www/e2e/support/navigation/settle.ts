import type { Page, Request } from "@playwright/test";
import { Array as Arr, Clock, Duration, Effect, Schema } from "effect";
import {
  APP_SCRIPT_PATTERN,
  NEXT_ROUTER_PREFETCH_HEADER,
  NEXT_ROUTER_REQUEST_HEADER,
  type RequestTracker,
  type TrackedRequestKind,
  withRequestTracker,
} from "@/e2e/support/requests";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const QUIET_MILLISECONDS = 500;
const POLL_MILLISECONDS = 100;

/** A prefetch or one of its scripts was still loading when the window ended. */
export class PrefetchSettleTimeout extends Schema.TaggedError<PrefetchSettleTimeout>()(
  "PrefetchSettleTimeout",
  {
    pending: Schema.Array(Schema.String),
    timeoutMilliseconds: Schema.Finite,
  }
) {
  get message() {
    return `Prefetch requests kept loading for ${this.timeoutMilliseconds} ms: ${Arr.join(this.pending, ", ") || "none pending, new requests kept starting"}`;
  }
}

/**
 * Classifies the application scripts, the prefetches of one destination, and
 * every other request of the router.
 *
 * The router sends each request with `fetch`. A prefetch the browser already
 * holds is served from its cache, and Chromium then revalidates the stale copy
 * in the background (`stale-while-revalidate`) with the same headers, as a
 * request of type `other` that Playwright never reports as finished. That
 * request is the browser's, so it is not counted.
 */
const createRequestClassifier = (pathname: string) =>
  function classifyRequest(request: Request): TrackedRequestKind | undefined {
    const url = new URL(request.url());
    if (APP_SCRIPT_PATTERN.test(url.pathname)) {
      return "javascript";
    }
    if (request.resourceType() !== "fetch") {
      return undefined;
    }
    const headers = request.headers();
    if (
      url.pathname === pathname &&
      headers[NEXT_ROUTER_PREFETCH_HEADER] !== undefined
    ) {
      return "prefetch";
    }
    return headers[NEXT_ROUTER_REQUEST_HEADER] === "1" ? "router" : undefined;
  };

/** The destination's prefetches and the scripts that have not landed yet. */
const readAwaitedRequests = (tracker: RequestTracker) =>
  Arr.appendAll(
    tracker.pendingRequests("javascript"),
    tracker.pendingRequests("prefetch")
  );

/**
 * Runs `intent`, returns its result, and first waits until the router is
 * quiet: the prefetch of the page at `pathname` and every script it loads have
 * landed, and no request of the router has started or ended for a short while.
 *
 * A prefetched page's scripts load as its response is read, so waiting for
 * them keeps a check that follows from depending on how fast the machine loads
 * code. A request for another page never has to end, because the router may
 * keep one open indefinitely, but while one starts or ends the page is still
 * working: a link that mounts late, such as one that waits for the session,
 * has yet to start its prefetch.
 *
 * That matters to a caller that takes the `instant()` lock next. The lock
 * gives its scope a private segment cache, and every prefetch that starts
 * inside the scope fills it. A navigation inside the scope then shares the
 * entries another link's prefetch has in flight instead of asking for them
 * itself, and when such an entry never arrives the navigation waits for the
 * lock to be released. Four failed runs of the homepage case showed that
 * order: the pricing link started its prefetch inside the lock, and the
 * navigation asked for the page segment alone.
 *
 * @see https://github.com/vercel/next.js/blob/v16.4.0/packages/next/src/client/components/segment-cache/navigation-testing-lock.ts
 * @see https://github.com/vercel/next.js/blob/v16.4.0/packages/next/src/client/components/segment-cache/scheduler.ts
 */
export const settlePrefetch = Effect.fn("NakafaE2E.settlePrefetch")(function* <
  A,
  E,
  R,
>(page: Page, pathname: string, intent: Effect.Effect<A, E, R>) {
  return yield* withRequestTracker(
    page,
    createRequestClassifier(pathname),
    (tracker) =>
      Effect.gen(function* () {
        const result = yield* intent;
        const startedAt = yield* Clock.currentTimeMillis;
        let quietSince = startedAt;
        let seenRevision = tracker.revision;
        while (true) {
          yield* Effect.sleep(Duration.millis(POLL_MILLISECONDS));
          const now = yield* Clock.currentTimeMillis;
          const awaited = readAwaitedRequests(tracker);
          if (
            Arr.isReadonlyArrayNonEmpty(awaited) ||
            tracker.revision !== seenRevision
          ) {
            seenRevision = tracker.revision;
            quietSince = now;
          }
          if (now - quietSince >= QUIET_MILLISECONDS) {
            return result;
          }
          if (now - startedAt > readinessTimeoutMilliseconds) {
            return yield* new PrefetchSettleTimeout({
              pending: Arr.map(awaited, ({ url }) => url),
              timeoutMilliseconds: readinessTimeoutMilliseconds,
            });
          }
        }
      })
  );
});
