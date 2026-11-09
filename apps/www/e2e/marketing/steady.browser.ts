import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { movePointerTo } from "@/e2e/support/input";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForQuiet } from "@/e2e/support/quiet";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The English Nakafa landing and the English School landing, as the address bar reads them. */
const HOME = /\/en$/u;
const SCHOOL_LANDING = /\/en\/school$/u;

/** The page global that holds the layout shifts of one document. */
const SHIFTS = "nakafaSteadyShifts";

/** The page global that holds the frames and the replacements of one document. */
const WATCH = "nakafaSteadyWatch";

/**
 * The layers that float over the page, whose own motion is not the page moving:
 * the header's section popup, the phone's menu drawer, and the toasts.
 */
const OVERLAYS =
  '[data-slot="navigation-menu-positioner"],[data-slot="drawer-popup"],[data-sonner-toaster]';

/** What one document saw: frames with no header or headline, and headers or headlines replaced after the first paint. */
const Watch = Schema.Struct({
  blank: Schema.Array(Schema.Finite),
  replaced: Schema.Array(Schema.String),
});

/**
 * Watches one document from its first script: every animation frame after the
 * document is parsed checks that the header and a headline with words stand in
 * the page, and a MutationObserver records each header or headline that leaves
 * the page while a new one takes its place in the same document. A client
 * navigation swaps the page's headline on purpose, so the caller reads the
 * replacements only for a load and a refresh, where hydration must keep what
 * the HTML painted.
 */
function watchPage(key: string) {
  const blank: number[] = [];
  const replaced: string[] = [];
  const watch = { blank, replaced };
  Object.defineProperty(window, key, { value: watch });
  const look = () => {
    if (document.readyState !== "loading") {
      const headline = document.querySelector("main h1");
      const header = document.querySelector("header");
      if (header === null || (headline?.textContent ?? "").trim() === "") {
        watch.blank.push(performance.now());
      }
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.removedNodes)) {
        if (
          node instanceof Element &&
          (node.matches("header, h1") || node.querySelector("header, h1"))
        ) {
          watch.replaced.push(
            `${node.tagName.toLowerCase()} at ${Math.round(performance.now())}`
          );
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

/** Reads what the current document's watch saw. */
const readWatch = Effect.fn("NakafaE2E.readSteadyWatch")(function* (
  page: Page
) {
  return yield* Effect.promise(() =>
    page.evaluate((name) => Reflect.get(window, name), WATCH)
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Watch)));
});

/** Waits for the page to go quiet, so its late work (sections, Nina, particles) has had its chance to move anything. */
const settle = (page: Page) => Effect.promise(() => waitForQuiet(page));

/**
 * Expects the current document to have drawn no blank frame and moved nothing.
 * `hydrated` also expects no header or headline replaced, for a load or a refresh.
 */
const expectSteady = Effect.fn("NakafaE2E.expectSteady")(function* (
  page: Page,
  phase: string,
  hydrated: boolean
) {
  yield* settle(page);
  const watch = yield* readWatch(page);
  const shifts = yield* readRecordedLayoutShifts(page, SHIFTS);
  yield* Effect.sync(() => {
    expect(watch.blank, `${phase}: blank frames`).toEqual([]);
    if (hydrated) {
      expect(watch.replaced, `${phase}: replaced on hydration`).toEqual([]);
    }
    expect(
      Arr.filter(shifts, (shift) => shift.value > 0),
      `${phase}: layout shifts`
    ).toEqual([]);
  });
});

/** Opens the School landing from the header: its section on a wide screen, the menu drawer on a phone. */
const openSchoolFromHeader = Effect.fn("NakafaE2E.openSchoolFromHeader")(
  function* (page: Page, phone: boolean) {
    const header = page.locator("header");
    if (phone) {
      yield* Effect.promise(() =>
        header.getByRole("button", { name: "Menu" }).click()
      );
      yield* Effect.promise(() =>
        page
          .getByRole("dialog", { name: "Menu" })
          .getByRole("link", { name: "Nakafa School" })
          .click()
      );
      return;
    }
    // The pointer comes to the trigger from the page, as a reader's does, so the trigger sees it arrive.
    yield* Effect.promise(() => page.mouse.move(8, 320));
    yield* movePointerTo(page, header.getByRole("button", { name: "School" }));
    yield* Effect.promise(() =>
      page
        .locator('[data-slot="navigation-menu-popup"]')
        .getByRole("link", { name: "Nakafa School" })
        .click()
    );
  }
);

/** Presses the header's menu open and closed without leaving the page: Escape on a wide screen, a tap outside on a phone. */
const pressMenu = Effect.fn("NakafaE2E.pressMenu")(function* (
  page: Page,
  phone: boolean
) {
  const header = page.locator("header");
  if (phone) {
    yield* Effect.promise(() =>
      header.getByRole("button", { name: "Menu" }).click()
    );
    const drawer = page.getByRole("dialog", { name: "Menu" });
    yield* Effect.promise(() => expect(drawer).toBeVisible());
    yield* Effect.promise(() => page.mouse.click(8, 8));
    yield* Effect.promise(() => expect(drawer).toHaveCount(0));
    return;
  }
  yield* Effect.promise(() =>
    header.getByRole("button", { name: "Learn" }).click()
  );
  const popup = page.locator('[data-slot="navigation-menu-popup"]');
  yield* Effect.promise(() => expect(popup).toBeVisible());
  yield* movePointerTo(page, header.getByRole("button", { name: "School" }));
  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(popup).toHaveCount(0));
});

for (const viewport of [touchViewport, desktopViewport]) {
  const phone = viewport.width < 1024;

  test.describe(`the marketing pages at ${viewport.width}px`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("draw no blank frame and move nothing on load, refresh, presses, the way between the two landings, back and forward", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* seedAnalyticsConsent(page, "denied");
            yield* Effect.promise(() =>
              page.addInitScript(recordLayoutShifts, {
                key: SHIFTS,
                overlay: OVERLAYS,
              })
            );
            yield* Effect.promise(() => page.addInitScript(watchPage, WATCH));

            yield* loadMarketingPage(page, "/en");
            yield* expectSteady(page, "hard load of /en", true);

            yield* Effect.promise(() => page.reload());
            yield* expectSteady(page, "refresh of /en", true);

            yield* pressMenu(page, phone);
            yield* expectSteady(page, "menu presses on /en", false);

            yield* openSchoolFromHeader(page, phone);
            yield* Effect.promise(() => expect(page).toHaveURL(SCHOOL_LANDING));
            yield* expectSteady(page, "from /en to /en/school", false);

            yield* Effect.promise(() => page.goBack());
            yield* Effect.promise(() => expect(page).toHaveURL(HOME));
            yield* expectSteady(page, "back to /en", false);

            yield* Effect.promise(() => page.goForward());
            yield* Effect.promise(() => expect(page).toHaveURL(SCHOOL_LANDING));
            yield* expectSteady(page, "forward to /en/school", false);

            yield* Effect.promise(() => page.reload());
            yield* expectSteady(page, "refresh of /en/school", true);

            yield* Effect.promise(() =>
              page
                .locator("header")
                .getByRole("link", { exact: true, name: "Nakafa" })
                .first()
                .click()
            );
            yield* Effect.promise(() => expect(page).toHaveURL(HOME));
            yield* expectSteady(page, "from /en/school to /en", false);

            yield* loadMarketingPage(page, "/en/school/pricing");
            yield* expectSteady(page, "hard load of /en/school/pricing", true);
          })
        )
      );
    });
  });
}
