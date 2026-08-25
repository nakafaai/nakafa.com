import type { Page, Request } from "@playwright/test";
import { Effect, Schema } from "effect";

export const JavascriptRequestFailureKindSchema = Schema.Literals([
  "http",
  "missing-response",
  "network",
]);

type JavascriptRequestFailureKind = Schema.Schema.Type<
  typeof JavascriptRequestFailureKindSchema
>;

export interface JavascriptRequestFailure {
  readonly errorText?: string;
  readonly kind: JavascriptRequestFailureKind;
  readonly status?: number;
  readonly url: string;
}

export interface JavascriptRequestTracker {
  readonly getFailure: () => JavascriptRequestFailure | undefined;
  readonly pendingCount: number;
  readonly prefetchObserved: boolean;
  readonly revision: number;
}

/** Tracks one same-origin JavaScript and router-prefetch request graph. */
export const withJavascriptRequestTracker = Effect.fn(
  "NakafaE2E.withJavascriptRequestTracker"
)(function* <A, E, R>(
  page: Page,
  applicationOrigin: string,
  javascriptResourcePattern: RegExp,
  use: (tracker: JavascriptRequestTracker) => Effect.Effect<A, E, R>
) {
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => {
      const pendingRequests = new Set<Request>();
      let failure: JavascriptRequestFailure | undefined;
      let prefetchObserved = false;
      let revision = 0;

      /**
       * Visible Links schedule default prefetches only after App Router state exists.
       * The segment cache marks those requests with `next-router-prefetch`.
       *
       * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/links.ts
       * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/segment-cache/cache.ts
       */
      const classifyRequest = (request: Request) => {
        const resourceUrl = new URL(request.url());
        if (resourceUrl.origin !== applicationOrigin) {
          return;
        }

        if (javascriptResourcePattern.test(resourceUrl.pathname)) {
          return "javascript";
        }

        if (request.headers()["next-router-prefetch"] !== undefined) {
          return "prefetch";
        }

        return;
      };
      const handleRequest = (request: Request) => {
        const requestKind = classifyRequest(request);
        if (!requestKind) {
          return;
        }
        if (requestKind === "prefetch") {
          prefetchObserved = true;
        }
        pendingRequests.add(request);
        revision += 1;
      };
      const settleRequest = (request: Request) => {
        if (!pendingRequests.delete(request)) {
          return false;
        }
        revision += 1;
        return true;
      };
      const handleRequestFailed = (request: Request) => {
        if (!settleRequest(request)) {
          return;
        }
        const requestFailure = request.failure();
        failure ??= requestFailure
          ? {
              errorText: requestFailure.errorText,
              kind: "network",
              url: request.url(),
            }
          : { kind: "network", url: request.url() };
      };
      const handleRequestFinished = (request: Request) => {
        if (!settleRequest(request)) {
          return;
        }
        const response = request.existingResponse();
        if (!response) {
          failure ??= {
            kind: "missing-response",
            url: request.url(),
          };
          return;
        }
        if (response.ok()) {
          return;
        }
        failure ??= {
          kind: "http",
          status: response.status(),
          url: request.url(),
        };
      };

      /**
       * Playwright reports network failures through `requestfailed`, while HTTP
       * error responses still finish through `requestfinished`.
       *
       * @see https://playwright.dev/docs/api/class-page#page-event-request-failed
       * @see https://playwright.dev/docs/api/class-page#page-event-request-finished
       */
      page.on("request", handleRequest);
      page.on("requestfailed", handleRequestFailed);
      page.on("requestfinished", handleRequestFinished);

      return {
        handleRequest,
        handleRequestFailed,
        handleRequestFinished,
        tracker: {
          getFailure() {
            return failure;
          },
          get pendingCount() {
            return pendingRequests.size;
          },
          get prefetchObserved() {
            return prefetchObserved;
          },
          get revision() {
            return revision;
          },
        },
      };
    }),
    ({ tracker }) => use(tracker),
    ({ handleRequest, handleRequestFailed, handleRequestFinished }) =>
      Effect.sync(() => {
        page.off("request", handleRequest);
        page.off("requestfailed", handleRequestFailed);
        page.off("requestfinished", handleRequestFinished);
      })
  );
});
