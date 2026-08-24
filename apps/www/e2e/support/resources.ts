import type { Browser, Page } from "@playwright/test";
import { Clock, Duration, Effect, Schema } from "effect";
import { withBrowserContext } from "./browser-context";

const JAVASCRIPT_RESOURCE_PATTERN =
  /^\/_next\/static\/(?:immutable\/)?chunks\/.+\.js$/;
const RESOURCE_IDLE_MILLISECONDS = 1000;
const RESOURCE_SETTLE_TIMEOUT_MILLISECONDS = 15_000;
const RESOURCE_POLL_MILLISECONDS = 100;

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

const waitForJavascriptResourcesToSettle = Effect.fn(
  "NakafaE2E.waitForJavascriptResourcesToSettle"
)(function* (page: Page, href: string) {
  const startedAt = yield* Clock.currentTimeMillis;
  let lastChangeAt = startedAt;
  let previousCount = -1;

  while (true) {
    const currentCount = yield* countJavascriptResources(page);
    const observedAt = yield* Clock.currentTimeMillis;
    if (currentCount !== previousCount) {
      previousCount = currentCount;
      lastChangeAt = observedAt;
    }
    if (observedAt - lastChangeAt >= RESOURCE_IDLE_MILLISECONDS) {
      return;
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

          yield* waitForJavascriptResourcesToSettle(page, href);
          return yield* readJavascriptRun(page);
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
