import type { Browser, Page, Request } from "@playwright/test";
import { Clock, Duration, Effect, Schema } from "effect";
import { withBrowserContext } from "./browser-context";
import { seedDeniedAnalyticsConsent } from "./consent";
import {
  RequestFailureKindSchema,
  type RequestTracker,
  type TrackedRequestKind,
  withRequestTracker,
} from "./request-tracker";

const JAVASCRIPT_RESOURCE_PATTERN =
  /^\/_next\/static\/(?:immutable\/)?chunks\/.+\.js$/;
const RESOURCE_IDLE_MILLISECONDS = 1000;
const RESOURCE_SETTLE_TIMEOUT_MILLISECONDS = 15_000;
const RESOURCE_POLL_MILLISECONDS = 100;

const createResourceRequestClassifier = (applicationOrigin: string) =>
  function classifyResourceRequest(
    request: Request
  ): TrackedRequestKind | undefined {
    const resourceUrl = new URL(request.url());
    if (resourceUrl.origin !== applicationOrigin) {
      return;
    }
    if (JAVASCRIPT_RESOURCE_PATTERN.test(resourceUrl.pathname)) {
      return "javascript";
    }
    if (request.headers()["next-router-prefetch"] !== undefined) {
      return "prefetch";
    }
  };

export interface JavascriptRun {
  readonly decodedBodySize: number;
  readonly encodedBodySize: number;
  readonly resourceCount: number;
  readonly urls: readonly string[];
}

export interface JavascriptMeasurement {
  readonly runs: readonly JavascriptRun[];
  readonly worst: Omit<JavascriptRun, "urls">;
}

/** A route did not return one successful document response. */
export class JavascriptResourceResponseError extends Schema.TaggedError<JavascriptResourceResponseError>()(
  "JavascriptResourceResponseError",
  {
    href: Schema.String,
    status: Schema.optional(Schema.Finite),
  }
) {}

/** A required JavaScript or router-prefetch request did not complete. */
export class JavascriptResourceRequestError extends Schema.TaggedError<JavascriptResourceRequestError>()(
  "JavascriptResourceRequestError",
  {
    errorText: Schema.optional(Schema.String),
    href: Schema.String,
    kind: RequestFailureKindSchema,
    status: Schema.optional(Schema.Finite),
    url: Schema.String,
  }
) {
  get message() {
    const status = this.status === undefined ? "" : ` status=${this.status}`;
    const errorText =
      this.errorText === undefined ? "" : ` errorText=${this.errorText}`;
    return `JavaScript resource request failed: kind=${this.kind} href=${this.href} url=${this.url}${status}${errorText}`;
  }
}

/** Next.js did not register a visible-link prefetch within the fixed window. */
export class JavascriptPrefetchReadinessTimeout extends Schema.TaggedError<JavascriptPrefetchReadinessTimeout>()(
  "JavascriptPrefetchReadinessTimeout",
  {
    href: Schema.String,
    timeoutMilliseconds: Schema.Finite,
  }
) {}

/** Matching JavaScript resources continued loading beyond the fixed window. */
export class JavascriptResourceSettleTimeout extends Schema.TaggedError<JavascriptResourceSettleTimeout>()(
  "JavascriptResourceSettleTimeout",
  {
    href: Schema.String,
    timeoutMilliseconds: Schema.Finite,
  }
) {}

const countJavascriptResources = Effect.fn(
  "NakafaE2E.countJavascriptResources"
)(function* (page: Page) {
  return yield* Effect.promise(() =>
    page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource);
      const urls = performance
        .getEntriesByType("resource")
        .map(({ name }) => name)
        .filter((url) => {
          const resourceUrl = new URL(url);
          return (
            resourceUrl.origin === location.origin &&
            pattern.test(resourceUrl.pathname)
          );
        });
      return new Set(urls).size;
    }, JAVASCRIPT_RESOURCE_PATTERN.source)
  );
});

const readJavascriptRun = Effect.fn("NakafaE2E.readJavascriptRun")(function* (
  page: Page
) {
  return yield* Effect.promise(() =>
    page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource);
      const resources = performance
        .getEntriesByType("resource")
        .filter(
          (entry): entry is PerformanceResourceTiming =>
            entry instanceof PerformanceResourceTiming
        )
        .filter((entry) => {
          const resourceUrl = new URL(entry.name);
          return (
            resourceUrl.origin === location.origin &&
            pattern.test(resourceUrl.pathname)
          );
        });
      const uniqueResources = new Map(
        resources.map((resource) => [resource.name, resource])
      );
      const entries = [...uniqueResources.values()];

      return {
        decodedBodySize: entries.reduce(
          (total, entry) => total + entry.decodedBodySize,
          0
        ),
        encodedBodySize: entries.reduce(
          (total, entry) => total + entry.encodedBodySize,
          0
        ),
        resourceCount: entries.length,
        urls: [...uniqueResources.keys()].sort(),
      };
    }, JAVASCRIPT_RESOURCE_PATTERN.source)
  );
});

const readSettledJavascriptRun = Effect.fn(
  "NakafaE2E.readSettledJavascriptRun"
)(function* (page: Page, href: string, requestTracker: RequestTracker) {
  const startedAt = yield* Clock.currentTimeMillis;
  let lastChangeAt = startedAt;
  let previousCount = -1;
  let previousRevision = -1;

  while (true) {
    const currentCount = yield* countJavascriptResources(page);
    const observedAt = yield* Clock.currentTimeMillis;
    const requestFailure = requestTracker.getFailure();
    if (requestFailure) {
      return yield* new JavascriptResourceRequestError({
        ...requestFailure,
        href,
      });
    }
    if (
      currentCount !== previousCount ||
      requestTracker.revision !== previousRevision
    ) {
      previousCount = currentCount;
      previousRevision = requestTracker.revision;
      lastChangeAt = observedAt;
    }
    if (!requestTracker.hasObserved("prefetch")) {
      if (observedAt - startedAt > RESOURCE_SETTLE_TIMEOUT_MILLISECONDS) {
        return yield* new JavascriptPrefetchReadinessTimeout({
          href,
          timeoutMilliseconds: RESOURCE_SETTLE_TIMEOUT_MILLISECONDS,
        });
      }
      yield* Effect.sleep(Duration.millis(RESOURCE_POLL_MILLISECONDS));
      continue;
    }
    if (
      requestTracker.pendingCount === 0 &&
      observedAt - lastChangeAt >= RESOURCE_IDLE_MILLISECONDS
    ) {
      const snapshotRevision = requestTracker.revision;
      const javascriptRun = yield* readJavascriptRun(page);
      const snapshotFailure = requestTracker.getFailure();
      if (snapshotFailure) {
        return yield* new JavascriptResourceRequestError({
          ...snapshotFailure,
          href,
        });
      }
      if (
        requestTracker.pendingCount === 0 &&
        requestTracker.revision === snapshotRevision
      ) {
        return javascriptRun;
      }
    }
    if (observedAt - startedAt > RESOURCE_SETTLE_TIMEOUT_MILLISECONDS) {
      return yield* new JavascriptResourceSettleTimeout({
        href,
        timeoutMilliseconds: RESOURCE_SETTLE_TIMEOUT_MILLISECONDS,
      });
    }
    yield* Effect.sleep(Duration.millis(RESOURCE_POLL_MILLISECONDS));
  }
});

/** Measures one route in three isolated, uncached Chromium contexts. */
export const measureRouteJavascript = Effect.fn(
  "NakafaE2E.measureRouteJavascript"
)(function* (browser: Browser, baseURL: string, href: string) {
  const runs: JavascriptRun[] = [];

  for (let run = 0; run < 3; run += 1) {
    const javascriptRun = yield* withBrowserContext(
      browser,
      {
        baseURL,
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* seedDeniedAnalyticsConsent(page);
          const applicationOrigin = new URL(baseURL).origin;
          const classifyRequest =
            createResourceRequestClassifier(applicationOrigin);

          return yield* withRequestTracker(
            page,
            classifyRequest,
            (requestTracker) =>
              Effect.gen(function* () {
                const session = yield* Effect.promise(() =>
                  context.newCDPSession(page)
                );
                yield* Effect.promise(() => session.send("Network.enable"));
                yield* Effect.promise(() =>
                  session.send("Network.setCacheDisabled", {
                    cacheDisabled: true,
                  })
                );

                const response = yield* Effect.promise(() =>
                  page.goto(href, { waitUntil: "domcontentloaded" })
                );
                if (!response?.ok()) {
                  return yield* new JavascriptResourceResponseError({
                    href,
                    status: response?.status(),
                  });
                }

                return yield* readSettledJavascriptRun(
                  page,
                  href,
                  requestTracker
                );
              })
          );
        })
    );
    runs.push(javascriptRun);
  }

  return {
    runs,
    worst: {
      decodedBodySize: Math.max(
        ...runs.map(({ decodedBodySize }) => decodedBodySize)
      ),
      encodedBodySize: Math.max(
        ...runs.map(({ encodedBodySize }) => encodedBodySize)
      ),
      resourceCount: Math.max(
        ...runs.map(({ resourceCount }) => resourceCount)
      ),
    },
  };
});
