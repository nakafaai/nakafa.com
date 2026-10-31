import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, Number as Num, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A curriculum page whose cards open lessons with their placement in `ctx`. */
const CURRICULUM = "/en/curriculum/merdeka/class-11/mathematics";
/** A lesson of that curriculum, opened with its placement. */
const CONTEXTUAL_LESSON =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept?ctx=merdeka~class-11-mathematics-function-composition-inverse-function";
/** How long the page keeps sampling once the new lesson has its body, so a late part shows. */
const SETTLE_MILLISECONDS = 1500;

/** What the page saw from the press until it settled. */
const Pressed = Schema.Struct({
  emptyFrames: Schema.Finite,
  frames: Schema.Finite,
  shifts: Schema.Array(Schema.Finite),
});

/**
 * Samples every frame from the press: a frame whose page holds an article with
 * no text is an empty body, and every layout shift that no input caused counts.
 * It starts when the test calls `nakafaWatchPress`, so the page's own load
 * counts for nothing.
 */
function recordPress() {
  const shifts: number[] = [];
  const record = { emptyFrames: 0, frames: 0, shifts };
  let watching = false;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (watching && !("hadRecentInput" in entry && entry.hadRecentInput)) {
        shifts.push("value" in entry ? Number(entry.value) : 0);
      }
    }
  }).observe({ type: "layout-shift" });
  const sample = () => {
    record.frames += 1;
    const article = document.querySelector("main article");
    if (article !== null && (article.textContent ?? "").trim() === "") {
      record.emptyFrames += 1;
    }
    requestAnimationFrame(sample);
  };
  Object.assign(window, {
    nakafaPress: record,
    nakafaWatchPress: () => {
      watching = true;
      requestAnimationFrame(sample);
    },
  });
}

/** The pagination's links: previous first, next last. */
const pagination = (page: Page) =>
  page
    .getByRole("navigation", { name: "Pagination navigation" })
    .getByRole("link");

/** The presses a reader makes into a lesson. */
const PRESSES = [
  {
    from: CURRICULUM,
    link: (page: Page) =>
      page.locator('main a[href*="function-concept?ctx="]').first(),
    name: "a curriculum card to its lesson",
  },
  {
    from: pinnedRoutes.material.en,
    link: (page: Page) => pagination(page).last(),
    name: "a lesson to the next",
  },
  {
    from: pinnedRoutes.material.en,
    link: (page: Page) => pagination(page).first(),
    name: "a lesson to the previous",
  },
  {
    from: CONTEXTUAL_LESSON,
    link: (page: Page) => pagination(page).last(),
    name: "a lesson in its curriculum to the next",
  },
] as const;

/**
 * Presses one link into a lesson and reads what the page drew until the new
 * lesson settled. A cold press is the reader's tap: the link starts loading on
 * the pointer's arrival, a moment before the press. A warm press waits until
 * the link's page has loaded.
 */
const pressInto = Effect.fn("NakafaE2E.pressIntoLesson")(function* (
  page: Page,
  from: string,
  link: Locator,
  warm: boolean
) {
  yield* Effect.promise(() => page.goto(from));
  yield* Effect.promise(() => waitUntilTakenOver(link));
  yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
  const href = yield* Effect.promise(() => link.getAttribute("href"));
  const target = new URL(href ?? "", page.url()).pathname;
  if (warm) {
    const answered = page.waitForResponse((response) =>
      response.url().includes("/_data/")
    );
    yield* Effect.promise(() => link.hover());
    yield* Effect.promise(() => answered);
  }
  yield* Effect.promise(() =>
    page.evaluate(() => Reflect.get(window, "nakafaWatchPress")())
  );
  yield* Effect.promise(() => link.click());
  yield* Effect.promise(() =>
    expect(page).toHaveURL((url) => url.pathname === target, {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() =>
    expect(page.locator("main article").first()).not.toBeEmpty({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => page.waitForTimeout(SETTLE_MILLISECONDS));
  return yield* Effect.promise(() =>
    page.evaluate(() => Reflect.get(window, "nakafaPress"))
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Pressed)));
});

for (const width of [390, 1440]) {
  for (const warm of [false, true]) {
    test.describe(`a ${warm ? "warm" : "cold"} press into a lesson at ${width}px`, () => {
      test.use({ viewport: { height: width < 768 ? 844 : 900, width } });

      for (const press of PRESSES) {
        test(`${press.name} draws the lesson whole: its body is never empty and nothing shifts`, async ({
          browserName,
          page,
        }) => {
          await Effect.runPromise(
            withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* seedAnalyticsConsent(page, "denied");
                yield* Effect.promise(() => page.addInitScript(recordPress));
                // A phone four times slower than this machine makes the moment
                // between the commit and the body long enough to see.
                if (browserName === "chromium") {
                  const cdp = yield* Effect.promise(() =>
                    page.context().newCDPSession(page)
                  );
                  yield* Effect.promise(() =>
                    cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
                  );
                }
                const pressed = yield* pressInto(
                  page,
                  press.from,
                  press.link(page),
                  warm
                );
                yield* Effect.sync(() => {
                  expect(pressed.frames).toBeGreaterThan(0);
                  expect(pressed.emptyFrames).toBe(0);
                  expect(Num.sumAll(pressed.shifts)).toBe(0);
                });
              })
            )
          );
        });
      }
    });
  }
}
