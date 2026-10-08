import type { Page, Request } from "@playwright/test";
import { Clock, Duration, Effect, Schema } from "effect";
import {
  APP_SCRIPT_PATTERN,
  NEXT_ROUTER_PREFETCH_HEADER,
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
    return `Prefetch requests kept loading for ${this.timeoutMilliseconds} ms: ${this.pending.join(", ") || "none pending, new requests kept starting"}`;
  }
}

/** Classifies the application scripts and the prefetches of one destination. */
const createRequestClassifier = (pathname: string) =>
  function classifyRequest(request: Request): TrackedRequestKind | undefined {
    const url = new URL(request.url());
    if (APP_SCRIPT_PATTERN.test(url.pathname)) {
      return "javascript";
    }
    if (
      url.pathname === pathname &&
      request.headers()[NEXT_ROUTER_PREFETCH_HEADER] !== undefined
    ) {
      return "prefetch";
    }
    return undefined;
  };

/**
 * Runs `intent`, then waits until the prefetch of the page at `pathname` and
 * every script it loads have landed, and nothing new has started for a short
 * while. A prefetched page's scripts load as its response is read, so waiting
 * for them keeps a check that follows from depending on how fast the machine
 * loads code. Prefetches of other pages are not the check's business: the
 * router may keep one open indefinitely.
 */
export const settlePrefetch = Effect.fn("NakafaE2E.settlePrefetch")(function* <
  E,
  R,
>(page: Page, pathname: string, intent: Effect.Effect<void, E, R>) {
  return yield* withRequestTracker(
    page,
    createRequestClassifier(pathname),
    (tracker) =>
      Effect.gen(function* () {
        yield* intent;
        const startedAt = yield* Clock.currentTimeMillis;
        let quietSince = startedAt;
        let seenRevision = tracker.revision;
        while (true) {
          yield* Effect.sleep(Duration.millis(POLL_MILLISECONDS));
          const now = yield* Clock.currentTimeMillis;
          if (tracker.pendingCount > 0 || tracker.revision !== seenRevision) {
            seenRevision = tracker.revision;
            quietSince = now;
          }
          if (now - quietSince >= QUIET_MILLISECONDS) {
            return;
          }
          if (now - startedAt > readinessTimeoutMilliseconds) {
            return yield* new PrefetchSettleTimeout({
              pending: [
                ...tracker.pendingRequests("javascript"),
                ...tracker.pendingRequests("prefetch"),
              ].map(({ url }) => url),
              timeoutMilliseconds: readinessTimeoutMilliseconds,
            });
          }
        }
      })
  );
});
