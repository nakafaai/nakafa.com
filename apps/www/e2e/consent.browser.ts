import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { Effect, Schema } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "./support/browser-context";
import { seedDeniedAnalyticsConsent } from "./support/consent";

const targetViewports = [
  { height: 800, name: "compact", slot: "drawer-popup", width: 320 },
  {
    hasTouch: true,
    height: 844,
    name: "touch",
    slot: "drawer-popup",
    width: 390,
  },
  { height: 1024, name: "tablet-portrait", slot: "dialog-content", width: 768 },
  {
    height: 768,
    name: "tablet-landscape",
    slot: "dialog-content",
    width: 1024,
  },
  { height: 900, name: "desktop", slot: "dialog-content", width: 1440 },
] as const;

/** The active compact drawer did not expose measurable swipe bounds. */
class ConsentDrawerBoundsMissing extends Schema.TaggedError<ConsentDrawerBoundsMissing>()(
  "ConsentDrawerBoundsMissing",
  {}
) {}

const prepareConsentPage = Effect.fn("NakafaE2E.prepareConsentPage")(function* (
  page: Page
) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto("/en", { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
});

const openConsentPreferences = Effect.fn("NakafaE2E.openConsentPreferences")(
  function* (page: Page, slot: (typeof targetViewports)[number]["slot"]) {
    const trigger = page
      .locator("footer")
      .getByRole("button", { name: "Usage data" });
    yield* Effect.promise(() => expect(trigger).toBeVisible());
    yield* Effect.promise(() => trigger.scrollIntoViewIfNeeded());
    yield* Effect.promise(() => trigger.focus());
    yield* Effect.promise(() => trigger.click());

    const popup = page.locator(`[data-slot="${slot}"]`);
    yield* Effect.promise(() => expect(popup).toBeVisible());
    yield* Effect.promise(() =>
      expect(page.getByRole("heading", { name: "Usage data" })).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(page.getByRole("button", { name: "Decline" })).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(page.getByRole("button", { name: "Allow" })).toBeVisible()
    );

    return { popup, trigger };
  }
);

const expectFocusContained = Effect.fn("NakafaE2E.expectConsentFocusContained")(
  function* (page: Page, popup: Locator) {
    yield* Effect.promise(() =>
      expect
        .poll(() =>
          popup.evaluate((element) => element.contains(document.activeElement))
        )
        .toBe(true)
    );

    for (let press = 0; press < 8; press += 1) {
      yield* Effect.promise(() => page.keyboard.press("Tab"));
      yield* Effect.promise(() =>
        expect
          .poll(() =>
            popup.evaluate((element) =>
              element.contains(document.activeElement)
            )
          )
          .toBe(true)
      );
    }
  }
);

const expectClosedWithFocusReturned = Effect.fn(
  "NakafaE2E.expectConsentClosedWithFocusReturned"
)(function* (popup: Locator, trigger: Locator) {
  yield* Effect.promise(() => expect(popup).toBeHidden());
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

const swipeDrawerClosed = Effect.fn("NakafaE2E.swipeConsentDrawerClosed")(
  function* (context: BrowserContext, page: Page, popup: Locator) {
    const bounds = yield* Effect.promise(() => popup.boundingBox());
    if (!bounds) {
      return yield* new ConsentDrawerBoundsMissing();
    }

    const x = bounds.x + bounds.width / 2;
    const startY = bounds.y + 12;
    const endY = Math.min(page.viewportSize()?.height ?? 844, startY + 320);

    yield* Effect.acquireUseRelease(
      Effect.promise(() => context.newCDPSession(page)),
      (session) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            session.send("Input.dispatchTouchEvent", {
              touchPoints: [{ x, y: startY }],
              type: "touchStart",
            })
          );
          for (let step = 1; step <= 5; step += 1) {
            yield* Effect.promise(() =>
              session.send("Input.dispatchTouchEvent", {
                touchPoints: [{ x, y: startY + ((endY - startY) * step) / 5 }],
                type: "touchMove",
              })
            );
          }
          yield* Effect.promise(() =>
            session.send("Input.dispatchTouchEvent", {
              touchPoints: [],
              type: "touchEnd",
            })
          );
        }),
      (session) => Effect.promise(() => session.detach())
    );
  }
);

for (const viewport of targetViewports) {
  test(`consent preferences preserve responsive UX at ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
          serviceWorkers: "block",
          viewport: { height: viewport.height, width: viewport.width },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* prepareConsentPage(page);
                const { popup, trigger } = yield* openConsentPreferences(
                  page,
                  viewport.slot
                );
                const otherSlot =
                  viewport.slot === "drawer-popup"
                    ? "dialog-content"
                    : "drawer-popup";
                yield* Effect.promise(() =>
                  expect(
                    page.locator(`[data-slot="${otherSlot}"]`)
                  ).toHaveCount(0)
                );
                yield* expectFocusContained(page, popup);
                yield* Effect.promise(() => page.keyboard.press("Escape"));
                yield* expectClosedWithFocusReturned(popup, trigger);
              })
            );
          })
      )
    );
  });
}

test("compact consent drawer preserves outside and swipe dismissal", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        hasTouch: true,
        serviceWorkers: "block",
        viewport: { height: 844, width: 390 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* prepareConsentPage(page);

              const outsideCase = yield* openConsentPreferences(
                page,
                "drawer-popup"
              );
              yield* Effect.promise(() => page.mouse.click(8, 8));
              yield* expectClosedWithFocusReturned(
                outsideCase.popup,
                outsideCase.trigger
              );

              const swipeCase = yield* openConsentPreferences(
                page,
                "drawer-popup"
              );
              yield* swipeDrawerClosed(context, page, swipeCase.popup);
              yield* expectClosedWithFocusReturned(
                swipeCase.popup,
                swipeCase.trigger
              );
            })
          );
        })
    )
  );
});
