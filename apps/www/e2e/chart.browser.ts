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
                yield* Effect.promise(() =>
                  expect(page.locator("article table")).toBeVisible()
                );
                yield* Effect.promise(() =>
                  expect(
                    page.locator('article [data-slot="chart"]')
                  ).toBeVisible()
                );
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
