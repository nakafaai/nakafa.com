import type { Browser } from "@playwright/test";

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

function countJavascriptResources(page: import("@playwright/test").Page) {
  return page.evaluate((patternSource) => {
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
  }, JAVASCRIPT_RESOURCE_PATTERN.source);
}

async function waitForJavascriptResourcesToSettle(
  page: import("@playwright/test").Page
) {
  const startedAt = Date.now();
  let lastChangeAt = startedAt;
  let previousCount = -1;

  while (Date.now() - startedAt <= RESOURCE_SETTLE_TIMEOUT_MILLISECONDS) {
    const currentCount = await countJavascriptResources(page);
    if (currentCount !== previousCount) {
      previousCount = currentCount;
      lastChangeAt = Date.now();
    }
    if (Date.now() - lastChangeAt >= RESOURCE_IDLE_MILLISECONDS) {
      return;
    }
    await page.waitForTimeout(RESOURCE_POLL_MILLISECONDS);
  }

  throw new Error(
    `JavaScript resources did not settle within ${RESOURCE_SETTLE_TIMEOUT_MILLISECONDS}ms.`
  );
}

function readJavascriptRun(
  page: import("@playwright/test").Page
): Promise<JavascriptRun> {
  return page.evaluate((patternSource) => {
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
  }, JAVASCRIPT_RESOURCE_PATTERN.source);
}

/** Measures one route in three isolated, uncached Chromium contexts. */
export async function measureRouteJavascript(
  browser: Browser,
  baseURL: string,
  href: string
): Promise<JavascriptMeasurement> {
  const runs: JavascriptRun[] = [];

  for (let run = 0; run < 3; run += 1) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { height: 900, width: 1440 },
    });

    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });

      const response = await page.goto(new URL(href, baseURL).href, {
        waitUntil: "domcontentloaded",
      });
      if (!response?.ok()) {
        throw new Error(
          `Resource measurement failed for ${href} with status ${response?.status() ?? "unknown"}.`
        );
      }

      await waitForJavascriptResourcesToSettle(page);
      runs.push(await readJavascriptRun(page));
    } finally {
      await context.close();
    }
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
}
