import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { LessonSchema } from "@/components/marketing/about/lesson/id";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonSection,
  lessonVisual,
  PROJECTILE_VIEW,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  desktopViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** How often the lesson panel's height is read once its visual is mounted. */
const HEIGHT_SAMPLE_MS = 200;

/** Enough samples to cover the wait with room to spare. */
const HEIGHT_SAMPLE_COUNT = Math.ceil(LESSON_WAIT_MS / HEIGHT_SAMPLE_MS);

/**
 * How many times the window's height is read after each tab is pressed. A lab
 * that loads late still changes the height within this time, so it is read long
 * enough to see that change.
 */
const TAB_SAMPLE_COUNT = 10;

/** The widths the window's height is checked at: a phone and a desktop. */
const WINDOW_VIEWPORTS = [touchViewport, desktopViewport];

/**
 * The height of the window: its tabs and the grid of its panels. Every panel
 * shares one grid cell, so the height is the one of the tallest panel.
 */
function lessonWindow(page: Page) {
  return lessonSection(page).locator('[data-slot="tabs"]');
}

test("home lesson window keeps its height once its visual is mounted", async ({
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
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              const panel = lessonPanel(page);
              yield* Effect.promise(() =>
                lessonSection(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );

              const heights = MutableList.make<number>();
              for (let count = 0; count < HEIGHT_SAMPLE_COUNT; count += 1) {
                const box = yield* Effect.promise(() => panel.boundingBox());
                if (box !== null) {
                  MutableList.append(heights, Math.round(box.height));
                }
                yield* Effect.promise(() =>
                  page.waitForTimeout(HEIGHT_SAMPLE_MS)
                );
              }
              expect(Arr.dedupe(MutableList.toArray(heights))).toHaveLength(1);
            })
          );
        })
    )
  );
});

for (const viewport of WINDOW_VIEWPORTS) {
  test(`home lesson window keeps its height before and after the reveal at ${viewport.width}px`, async ({
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
          viewport: viewportSize(viewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* openRoute(page, "/id", "denied");
                const root = lessonWindow(page);

                // Before the reveal the open panel holds its frame, which must already be the window's height.
                const before = yield* Effect.promise(() => root.boundingBox());
                expect(before).not.toBeNull();

                yield* Effect.promise(() =>
                  lessonSection(page).scrollIntoViewIfNeeded()
                );
                yield* Effect.promise(() =>
                  expect(
                    lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                  ).toBeAttached({
                    timeout: readinessTimeoutMilliseconds,
                  })
                );
                const revealed = yield* Effect.promise(() =>
                  root.boundingBox()
                );
                expect(Math.round(revealed?.height ?? 0)).toBe(
                  Math.round(before?.height ?? -1)
                );
              })
            );
          })
      )
    );
  });
}

for (const viewport of WINDOW_VIEWPORTS) {
  test(`home lesson window holds one height through every tab at ${viewport.width}px`, async ({
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
          viewport: viewportSize(viewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* openRoute(page, "/id", "denied");
                const root = lessonWindow(page);
                const tabs = lessonSection(page).getByRole("tab");
                yield* Effect.promise(() =>
                  lessonSection(page).scrollIntoViewIfNeeded()
                );

                const heights = MutableList.make<number>();
                for (
                  let index = 0;
                  index < Arr.length(LessonSchema.literals);
                  index += 1
                ) {
                  yield* Effect.promise(() => tabs.nth(index).click());
                  yield* Effect.promise(() =>
                    expect(
                      lessonPanel(page).locator("canvas").first()
                    ).toBeAttached({
                      timeout: readinessTimeoutMilliseconds,
                    })
                  );
                  for (let count = 0; count < TAB_SAMPLE_COUNT; count += 1) {
                    const box = yield* Effect.promise(() => root.boundingBox());
                    if (box !== null) {
                      MutableList.append(heights, Math.round(box.height));
                    }
                    yield* Effect.promise(() =>
                      page.waitForTimeout(HEIGHT_SAMPLE_MS)
                    );
                  }
                }
                expect(Arr.dedupe(MutableList.toArray(heights))).toHaveLength(
                  1
                );
              })
            );
          })
      )
    );
  });
}
