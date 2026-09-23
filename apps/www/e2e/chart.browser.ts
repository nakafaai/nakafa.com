import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { pinnedRoutes } from "@/e2e/support/corpus";

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
                  yield* Effect.promise(async () => {
                    await page.setViewportSize({ width, height: 900 });
                    const chart = page
                      .locator('article [data-slot="chart"]')
                      .filter({ visible: true });
                    await chart
                      .locator('xpath=ancestor::*[@data-slot="card"]')
                      .scrollIntoViewIfNeeded();
                    await chart.scrollIntoViewIfNeeded();
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
