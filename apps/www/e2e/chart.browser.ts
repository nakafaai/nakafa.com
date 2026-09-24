import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { pinnedRoutes } from "@/e2e/support/corpus";

const revealChart = Effect.fn("NakafaE2E.revealChart")(function* (
  chart: Locator
) {
  // Hydration can replace a streamed chart. Re-resolve its locator
  // until the visible plot is in the viewport.
  yield* Effect.promise(() =>
    expect(async () => {
      await chart
        .locator('xpath=ancestor::*[@data-slot="card"]')
        .scrollIntoViewIfNeeded();
      await chart.scrollIntoViewIfNeeded();
      await expect(chart.locator("svg.recharts-surface")).toBeInViewport();
    }).toPass({ timeout: 5000 })
  );
});

test("chart articles retain server HTML after caching in every locale", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              for (const href of Object.values(pinnedRoutes.cabinet)) {
                yield* Effect.promise(() => page.goto(href));
                // Streamed segments can briefly retain a hidden article copy.
                yield* Effect.promise(() =>
                  expect(
                    page.locator("article").getByRole("table")
                  ).toBeVisible()
                );
                yield* Effect.promise(() =>
                  expect(
                    page
                      .locator('article [data-slot="chart"]')
                      .filter({ visible: true })
                  ).toBeVisible()
                );
                for (const width of [390, 1280]) {
                  yield* Effect.promise(() =>
                    page.setViewportSize({ width, height: 900 })
                  );
                  const chart = page
                    .locator('article [data-slot="chart"]')
                    .filter({ visible: true });
                  yield* revealChart(chart);
                  yield* Effect.promise(async () => {
                    await expect
                      .poll(() =>
                        chart.evaluate((element) => {
                          const bounds = element.getBoundingClientRect();
                          const labels = Array.from(
                            element.querySelectorAll(
                              ".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value"
                            )
                          );
                          return {
                            count: labels.length,
                            clipped: labels
                              .filter((label) => {
                                const rect = label.getBoundingClientRect();
                                return (
                                  rect.width === 0 ||
                                  rect.left < bounds.left - 1 ||
                                  rect.right > bounds.right + 1 ||
                                  rect.top < bounds.top - 1 ||
                                  rect.bottom > bounds.bottom + 1
                                );
                              })
                              .map((label) => label.textContent),
                          };
                        })
                      )
                      .toEqual({ count: 8, clipped: [] });
                  });
                }
                // Parsing the response excludes content present only in RSC
                // scripts or inserted later by client hydration.
                yield* Effect.promise(() =>
                  expect
                    .poll(
                      async () => {
                        const response = await context.request.get(href);
                        const html = await response.text();
                        const content = await page.evaluate((source) => {
                          const document = new DOMParser().parseFromString(
                            source,
                            "text/html"
                          );
                          return {
                            articles:
                              document.querySelectorAll("article").length,
                            charts: document.querySelectorAll(
                              'article [data-slot="chart"]'
                            ).length,
                            tables:
                              document.querySelectorAll("article table").length,
                          };
                        }, html);
                        return {
                          ...content,
                          cache: response.headers()["x-nextjs-cache"],
                          status: response.status(),
                        };
                      },
                      { timeout: 30_000 }
                    )
                    .toEqual({
                      articles: 1,
                      cache: "HIT",
                      charts: 1,
                      status: 200,
                      tables: 1,
                    })
                );
              }
            })
          );
        })
    )
  );
});

/** Verifies hydrated plots and their server tables after each navigation or reload. */
const expectFunctionCharts = Effect.fn("NakafaE2E.expectFunctionCharts")(
  function* (page: Page) {
    const charts = page
      .locator('article [data-slot="chart"]')
      .filter({ visible: true });
    yield* Effect.promise(() => expect(charts).toHaveCount(2));
    for (const chart of yield* Effect.promise(() => charts.all())) {
      yield* revealChart(chart);
    }
    yield* Effect.promise(() =>
      expect(page.locator("article table:has(caption)")).toHaveCount(2)
    );
  }
);

test("function charts retain their tables and hydrate after a cached reload", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", serviceWorkers: "block" },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const failedScripts: string[] = [];
          page.on("response", (response) => {
            if (
              response.request().resourceType() === "script" &&
              !response.ok()
            ) {
              failedScripts.push(response.url());
            }
          });
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              for (const href of Object.values(pinnedRoutes.growth)) {
                yield* Effect.promise(() => page.goto(href));
                for (const width of [1280, 390]) {
                  yield* Effect.promise(() =>
                    page.setViewportSize({ width, height: 900 })
                  );
                  yield* expectFunctionCharts(page);
                  yield* Effect.promise(() => page.reload());
                  yield* expectFunctionCharts(page);
                }
                yield* Effect.promise(async () => {
                  const response = await context.request.get(href);
                  expect(response.ok()).toBe(true);
                  const html = await response.text();
                  const serverTables = await page.evaluate((source) => {
                    const document = new DOMParser().parseFromString(
                      source,
                      "text/html"
                    );
                    return document.querySelectorAll(
                      "article table:has(caption)"
                    ).length;
                  }, html);
                  expect(serverTables).toBe(2);
                });
              }
              expect(failedScripts).toEqual([]);
            })
          );
        })
    )
  );
});
