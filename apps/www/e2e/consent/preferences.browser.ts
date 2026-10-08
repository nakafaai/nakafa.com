import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  openConsentPreferences,
  seedAnalyticsConsent,
} from "@/e2e/support/consent";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/context";
import { dragTouch, readBounds } from "@/e2e/support/input";
import { targetViewports } from "@/e2e/support/viewport";

/** The surface each viewport opens: a drawer on a phone, a dialog on wider screens. */
const slotByViewport = {
  compact: "drawer-popup",
  desktop: "dialog-content",
  "tablet-landscape": "dialog-content",
  "tablet-portrait": "dialog-content",
  touch: "drawer-popup",
} as const;

const consentViewports = targetViewports.map((viewport) => ({
  ...viewport,
  slot: slotByViewport[viewport.name],
}));

const prepareConsentPage = Effect.fn("NakafaE2E.prepareConsentPage")(function* (
  page: Page
) {
  yield* seedAnalyticsConsent(page, "denied");
  const response = yield* Effect.promise(() =>
    page.goto("/en", { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
});

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
  function* (page: Page, popup: Locator) {
    // Raw touch coordinates need the opening drawer to finish moving first.
    yield* Effect.promise(() =>
      popup.locator('[data-slot="drawer-bar"]').click({ trial: true })
    );
    const bounds = yield* readBounds(popup, "consent-drawer");

    const x = bounds.x + bounds.width / 2;
    const startY = bounds.y + 12;
    const endY = Math.min(page.viewportSize()?.height ?? 844, startY + 320);

    yield* dragTouch(page, { x, y: startY }, { x, y: endY });
  }
);

for (const viewport of consentViewports) {
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
          hasTouch: viewport.hasTouch,
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
              yield* swipeDrawerClosed(page, swipeCase.popup);
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
