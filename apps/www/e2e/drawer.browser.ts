import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const usageDataName = "Usage data";
const readinessTimeoutMilliseconds = 15_000;
const quranIndexUrlPattern = /\/id\/quran$/;
const quranSurahUrlPattern = /\/id\/quran\/2$/;

const prepareConsentPreferences = Effect.fn(
  "NakafaE2E.prepareDrawerConsentPreferences"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto("/en", { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    "/en",
    "/en",
    readinessTimeoutMilliseconds
  );

  const trigger = page
    .locator("footer")
    .getByRole("button", { name: usageDataName });
  yield* Effect.promise(() => expect(trigger).toBeVisible());
  yield* Effect.promise(() => trigger.scrollIntoViewIfNeeded());
  return trigger;
});

const verifyCompactConsentDrawer = Effect.fn(
  "NakafaE2E.verifyCompactConsentDrawer"
)(function* (page: Page) {
  const trigger = yield* prepareConsentPreferences(page);
  yield* Effect.promise(() => trigger.click());

  const drawer = page.locator('[data-slot="drawer-popup"]');
  yield* Effect.promise(() => expect(drawer).toBeVisible());
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-bar"]')).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(
      usageDataName
    )
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-description"]')).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-panel"]')).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-footer"]')).toBeVisible()
  );

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

const verifyDesktopConsentDialog = Effect.fn(
  "NakafaE2E.verifyDesktopConsentDialog"
)(function* (page: Page) {
  const trigger = yield* prepareConsentPreferences(page);
  yield* Effect.promise(() => trigger.click());

  const dialog = page.locator('[data-slot="dialog-content"]');
  yield* Effect.promise(() => expect(dialog).toBeVisible());
  yield* Effect.promise(() =>
    expect(dialog.locator('[data-slot="dialog-title"]')).toHaveText(
      usageDataName
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator('[data-slot="drawer-popup"]')).toHaveCount(0)
  );

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(dialog).toHaveCount(0));
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

const verifyQuranInterpretationDrawer = Effect.fn(
  "NakafaE2E.verifyQuranInterpretationDrawer"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto("/id/quran/2", { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    "/id/quran/2",
    "/id/quran/2",
    readinessTimeoutMilliseconds
  );

  const trigger = page.locator("[data-quran-interpretation-verse]").first();
  yield* Effect.promise(() => expect(trigger).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() => expect(trigger).toBeEnabled({ timeout: 15_000 }));
  yield* Effect.promise(() => trigger.click());

  const drawer = page.locator('[data-slot="drawer-popup"]');
  yield* Effect.promise(() => expect(drawer).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-bar"]')).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText("Tafsir")
  );
  yield* Effect.promise(() =>
    expect(drawer.locator('[data-slot="drawer-panel"]')).not.toBeEmpty()
  );

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));

  const quranIndexLink = page.locator('a[href="/id/quran"]').first();
  yield* Effect.promise(() => expect(quranIndexLink).toBeVisible());
  yield* Effect.promise(() => quranIndexLink.click());
  yield* Effect.promise(() => expect(page).toHaveURL(quranIndexUrlPattern));
  yield* Effect.promise(() => expect(trigger).toBeAttached());
  yield* Effect.promise(() => expect(trigger).toBeHidden());
  yield* Effect.promise(() => expect(trigger).toBeDisabled());
  yield* Effect.promise(() => expect(trigger).toHaveCSS("opacity", "1"));

  yield* Effect.promise(() => page.goBack());
  yield* Effect.promise(() => expect(page).toHaveURL(quranSurahUrlPattern));
  yield* waitForCommittedAppRouter(
    page,
    "/id/quran",
    "/id/quran/2",
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() => expect(trigger).toBeVisible());
  yield* Effect.promise(() => expect(trigger).toBeEnabled());
  yield* Effect.promise(() => expect(trigger).toHaveCSS("opacity", "1"));
  yield* Effect.promise(() => trigger.click());
  yield* Effect.promise(() => expect(drawer).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));
});

test.describe("public Drawer consumers", () => {
  test.describe("compact responsive dialog", () => {
    test.use({ viewport: { height: 844, width: 390 } });

    test("keeps the consent surface as a styled bottom drawer", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyCompactConsentDrawer(page))
      );
    });
  });

  test.describe("desktop responsive dialog", () => {
    test.use({ viewport: { height: 900, width: 1440 } });

    test("keeps the consent surface as a dialog on desktop", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyDesktopConsentDialog(page))
      );
    });
  });

  test.describe("Quran interpretation", () => {
    test.use({ viewport: { height: 844, width: 390 } });

    test("keeps the tafsir drawer content and dismissal behavior", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyQuranInterpretationDrawer(page))
      );
    });
  });
});
