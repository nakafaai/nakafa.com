import { expect, type Page, test } from "@playwright/test";
import { Effect, Record as Rec } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readHeadLinks } from "@/e2e/support/crawler";
import { NavigationLinkMissing } from "@/e2e/support/navigation/cases";
import { withObservedPageErrors } from "@/e2e/support/observe";

/** Captures the rendered lesson identity and its canonical metadata. */
const readLessonIdentity = Effect.fn("NakafaE2E.readLessonIdentity")(function* (
  page: Page
) {
  const title = yield* Effect.promise(() => page.title());
  const heading = yield* Effect.promise(() =>
    page.getByRole("heading", { level: 1 }).textContent()
  );
  const links = yield* Effect.promise(() =>
    page.evaluate(readHeadLinks, undefined)
  );
  return { heading, links, title };
});

for (const [locale, href] of Rec.toEntries(pinnedRoutes.material)) {
  test(`adjacent ${locale} lessons navigate with their own metadata`, async ({
    baseURL,
    browser,
  }) => {
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          ...(baseURL === undefined ? {} : { baseURL }),
          viewport: { width: 1280, height: 900 },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                const run = Effect.runPromiseWith(
                  yield* Effect.context<never>()
                );
                yield* Effect.promise(() => page.goto(href));
                const pagination = page.getByRole("navigation", {
                  name: "Pagination navigation",
                });
                const next = pagination.locator("a[href]:visible").last();
                yield* Effect.promise(() => expect(next).toBeVisible());
                const destination = yield* Effect.promise(() =>
                  next.getAttribute("href")
                );
                if (!destination || destination === href) {
                  return yield* new NavigationLinkMissing({
                    hrefPattern: "the next lesson",
                    sourceHref: href,
                  });
                }

                const reference = yield* Effect.promise(() =>
                  context.newPage()
                );
                yield* Effect.promise(() => reference.goto(destination));
                yield* Effect.promise(() =>
                  expect(
                    reference.getByRole("heading", { level: 1 })
                  ).toBeVisible()
                );
                yield* Effect.promise(() =>
                  expect(
                    reference.locator('link[rel="canonical"]')
                  ).toHaveAttribute("href", `https://nakafa.com${destination}`)
                );
                const expected = yield* readLessonIdentity(reference);
                const initial = yield* readLessonIdentity(page);
                yield* Effect.sync(() =>
                  expect(expected.title).not.toBe(initial.title)
                );
                yield* Effect.promise(() => reference.close());

                yield* Effect.promise(() => next.click());
                yield* Effect.promise(() =>
                  expect(page).toHaveURL((url) => url.pathname === destination)
                );
                yield* Effect.promise(() =>
                  expect
                    .poll(() => run(readLessonIdentity(page)))
                    .toEqual(expected)
                );
                yield* Effect.promise(() => page.goBack());
                yield* Effect.promise(() =>
                  expect
                    .poll(() => run(readLessonIdentity(page)))
                    .toEqual(initial)
                );
              })
            );
          })
      )
    );
  });
}
