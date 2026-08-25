import type { Frame, Page, Request } from "@playwright/test";
import { Clock, Duration, Effect } from "effect";
import {
  type RequestTracker,
  type TrackedRequestKind,
  withRequestTracker,
} from "../request-tracker";
import { NavigationReadinessTimeout, NavigationRequestError } from "./failure";

const NEXT_ROUTER_PREFETCH_HEADER = "next-router-prefetch";
const PREFETCH_POLL_MILLISECONDS = 25;

const waitForTargetPrefetch = Effect.fn("NakafaE2E.waitForTargetPrefetch")(
  function* (
    tracker: RequestTracker,
    sourceHref: string,
    targetHref: string,
    timeoutMilliseconds: number
  ) {
    const startedAt = yield* Clock.currentTimeMillis;

    while (true) {
      const requestFailure = tracker.getFailure();
      if (requestFailure) {
        return yield* new NavigationRequestError({
          ...requestFailure,
          href: targetHref,
          sourceHref,
        });
      }
      if (
        tracker.hasObserved("prefetch") &&
        tracker.successfulCount("prefetch") > 0 &&
        tracker.pendingCount === 0
      ) {
        return;
      }
      const observedAt = yield* Clock.currentTimeMillis;
      if (observedAt - startedAt > timeoutMilliseconds) {
        return yield* new NavigationReadinessTimeout({
          href: targetHref,
          phase: "prefetch",
          sourceHref,
          timeoutMilliseconds,
        });
      }
      yield* Effect.sleep(Duration.millis(PREFETCH_POLL_MILLISECONDS));
    }
  }
);

/** Observes one successful exact-target prefetch before instant navigation. */
export const withTargetPrefetch = Effect.fn("NakafaE2E.withTargetPrefetch")(
  function* <A, E, R>(
    page: Page,
    applicationOrigin: string,
    sourceHref: string,
    targetHref: string,
    timeoutMilliseconds: number,
    use: () => Effect.Effect<A, E, R>
  ) {
    const sourcePathname = new URL(sourceHref, applicationOrigin).pathname;
    const targetPathname = new URL(targetHref, applicationOrigin).pathname;
    let sourceCommitted = false;
    const classifyTargetPrefetch = (
      request: Request
    ): TrackedRequestKind | undefined => {
      if (!sourceCommitted) {
        return;
      }
      if (request.headers()[NEXT_ROUTER_PREFETCH_HEADER] === undefined) {
        return;
      }
      const requestUrl = new URL(request.url());
      if (
        requestUrl.origin !== applicationOrigin ||
        requestUrl.pathname !== targetPathname
      ) {
        return;
      }
      return "prefetch";
    };

    return yield* withRequestTracker(page, classifyTargetPrefetch, (tracker) =>
      Effect.acquireUseRelease(
        Effect.sync(() => {
          const handleFrameNavigated = (frame: Frame) => {
            if (frame !== page.mainFrame()) {
              return;
            }
            const frameUrl = new URL(frame.url());
            if (
              frameUrl.origin !== applicationOrigin ||
              frameUrl.pathname !== sourcePathname
            ) {
              return;
            }
            sourceCommitted = true;
            tracker.reset();
          };
          page.on("framenavigated", handleFrameNavigated);
          return handleFrameNavigated;
        }),
        () =>
          Effect.gen(function* () {
            const value = yield* use();

            /**
             * This proves the exact target Link mounted, entered the viewport,
             * and completed at least one successful prefetch. It deliberately
             * does not claim that a quiet interval proves Next's whole scheduler
             * graph. The installed `instant()` lock owns the subsequent
             * navigation and consumes the warmed prefetch cache.
             *
             * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/links.ts
             * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/segment-cache/navigation.ts
             * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/segment-cache/scheduler.ts
             * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next-playwright/README.md
             */
            yield* waitForTargetPrefetch(
              tracker,
              sourceHref,
              targetHref,
              timeoutMilliseconds
            );
            return value;
          }),
        (handleFrameNavigated) =>
          Effect.sync(() => {
            page.off("framenavigated", handleFrameNavigated);
          })
      )
    );
  }
);
