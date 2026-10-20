import type { Page, Request } from "@playwright/test";
import { Array as Arr, Clock, Duration, Effect, Schema } from "effect";
import {
  APP_SCRIPT_PATTERN,
  type RequestTracker,
  SERVER_FUNCTION_HEADER,
  type TrackedRequestKind,
  withRequestTracker,
} from "../requests";
import { readinessTimeoutMilliseconds } from "../timeout";

const QUIET_MILLISECONDS = 500;
const POLL_MILLISECONDS = 100;

/** The router still had a script or a data request in flight when the window ended. */
class RouterSettleTimeout extends Schema.TaggedError<RouterSettleTimeout>()(
  "RouterSettleTimeout",
  {
    pending: Schema.Array(Schema.String),
    timeoutMilliseconds: Schema.Finite,
  }
) {
  get message() {
    return `The router kept loading for ${this.timeoutMilliseconds} ms: ${Arr.join(this.pending, ", ") || "none pending, new requests kept starting"}`;
  }
}

/**
 * Classifies the application scripts and the data of the router. The router
 * calls a server function for the loader data of a navigation and of an intent
 * preload alike, so both count as data.
 */
function classifyRequest(request: Request): TrackedRequestKind | undefined {
  if (APP_SCRIPT_PATTERN.test(new URL(request.url()).pathname)) {
    return "javascript";
  }
  if (
    request.resourceType() === "fetch" &&
    request.headers()[SERVER_FUNCTION_HEADER] === "true"
  ) {
    return "data";
  }
  return undefined;
}

/** The scripts and the data that have not landed yet. */
const readAwaitedRequests = (tracker: RequestTracker) =>
  Arr.appendAll(
    tracker.pendingRequests("javascript"),
    tracker.pendingRequests("data")
  );

/**
 * Runs `intent`, returns its result, and first waits until the router is quiet:
 * every script and every data request that the intent started has landed, and
 * no request of the router has started or ended for a short while.
 *
 * Intent is what a reader shows before a press, so the router loads the link's
 * route and data on intent. A press that follows a settled router finds that
 * data in the router's cache, which is what the navigation checks measure.
 */
export const settleRouter = Effect.fn("NakafaE2E.settleRouter")(function* <
  A,
  E,
  R,
>(page: Page, intent: Effect.Effect<A, E, R>) {
  return yield* withRequestTracker(page, classifyRequest, (tracker) =>
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
          return yield* new RouterSettleTimeout({
            pending: Arr.map(awaited, ({ url }) => url),
            timeoutMilliseconds: readinessTimeoutMilliseconds,
          });
        }
      }
    })
  );
});
