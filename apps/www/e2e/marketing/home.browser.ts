import { expect, type Page, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";

/** The parts of the home page, in the order of the page. */
const HOME_PARTS = [
  "hero",
  "lesson",
  "tryout",
  "nina",
  "scene",
  "memory",
  "privacy",
  "curricula",
  "letter",
  "medals",
  "pricing",
  "school",
  "faq",
  "community",
  "closing",
] as const;

/** The widths the home page must hold at, from a phone to a desktop. */
const HOME_VIEWPORTS = [
  { height: 844, name: "phone", width: 390 },
  { height: 1024, name: "tablet", width: 768 },
  { height: 900, name: "desktop", width: 1440 },
] as const;

/** The two colour schemes the home page must hold in. */
const COLOR_SCHEMES = ["light", "dark"] as const;

/**
 * Long enough for a lesson to stay open for its full turn after it reaches the
 * screen, with room for the observer to see it. A lesson opens its next one
 * after six seconds.
 */
const LESSON_TURN_MS = 8000;

/**
 * Scrolls the whole page one screen at a time, so every part reaches the
 * viewport and every observer runs, then returns to the top.
 */
const scrollThroughPage = Effect.fn("NakafaE2E.scrollThroughPage")(function* (
  page: Page
) {
  const height = yield* Effect.promise(() =>
    page.evaluate(() => window.innerHeight)
  );
  const documentHeight = yield* Effect.promise(() =>
    page.evaluate(() => document.documentElement.scrollHeight)
  );
  for (
    let offset = 0;
    offset < documentHeight;
    offset += Math.round(height * 0.8)
  ) {
    yield* Effect.promise(() =>
      page.evaluate((top) => window.scrollTo(0, top), offset)
    );
    yield* Effect.promise(() => page.waitForTimeout(120));
  }
  yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
});

/** Collects the console errors and warnings a page writes, hydration warnings included. */
function observeConsole(page: Page) {
  const issues = MutableList.make<string>();
  page.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      MutableList.append(issues, `${type}: ${message.text()}`);
    }
  });
  return issues;
}

for (const viewport of HOME_VIEWPORTS) {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`home page keeps still and quiet at ${viewport.name} in ${colorScheme}`, async ({
      baseURL,
      browser,
    }) => {
      expect(baseURL).toBeTruthy();
      await Effect.runPromise(
        withBrowserContext(
          browser,
          {
            baseURL: baseURL ?? "",
            colorScheme,
            reducedMotion: "no-preference",
            serviceWorkers: "block",
            viewport: { height: viewport.height, width: viewport.width },
          },
          (context) =>
            Effect.gen(function* () {
              const page = yield* Effect.promise(() => context.newPage());
              const issues = observeConsole(page);
              yield* withObservedPageErrors(
                page,
                Effect.gen(function* () {
                  yield* openRoute(page, "/id", "denied");
                  yield* Effect.promise(() =>
                    page.waitForLoadState("networkidle")
                  );
                  yield* scrollThroughPage(page);
                  const shift = yield* readCumulativeLayoutShift(page);
                  expect(shift).toBe(0);
                  expect(MutableList.toArray(issues)).toEqual([]);
                })
              );
            })
        )
      );
    });
  }
}

test("home page carries every part in Indonesian, English and German", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.forEach(["id", "en", "de"], (locale) =>
              Effect.gen(function* () {
                yield* openRoute(page, `/${locale}`, "denied");
                yield* Effect.promise(() =>
                  expect(page.locator("h1")).toBeVisible()
                );
                yield* Effect.forEach(HOME_PARTS, (part) =>
                  Effect.promise(() =>
                    expect(page.locator(`#${part}`)).toBeAttached()
                  )
                );
              })
            )
          );
        })
    )
  );
});

test("home page holds still with reduced motion", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Gerak parabola")
              );
            })
          );
        })
    )
  );
});

test("home page opens the next lesson by itself while the lessons are on screen", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Fungsi kuadrat")
              );
            })
          );
        })
    )
  );
});
