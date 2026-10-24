import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { readPaints, recordPaints, summarizePaints } from "@/e2e/support/paint";
import { TOASTER } from "@/e2e/support/selector";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** How long the recorder watches the page after the press. */
const RECORD_MILLISECONDS = 1500;
/** The main region of the app shell, which holds the page a learner is on. */
const MAIN = 'main[data-slot="sidebar-inset"]';
/** The page global that holds the layout shifts of one navigation. */
const SHIFTS = "nakafaNavigationShifts";
/** The trigger of the signed-in learner's account menu. */
const ACCOUNT_TRIGGER =
  '[data-account="member"]:visible button[aria-haspopup="menu"]';

test.use({ viewport: viewportSize(desktopViewport) });

/** The account menu items that open a page of the account, and the address each one opens. */
const destinations = [
  { item: "Profile", path: /\/en\/(user\/|@)/ },
  { item: "Notifications", path: /\/en\/notifications$/ },
  { item: "Settings", path: /\/en\/user\/settings$/ },
] as const;

/**
 * Opens the account menu of the search page, presses one of its items while the
 * frame recorder watches the main region, and returns the moment of the press.
 */
async function pressAccountItem(page: Page, item: string, path: RegExp) {
  await expect(page.locator(ACCOUNT_TRIGGER)).toBeVisible();
  // The menu body is in the document, hidden, once the menu warms.
  await expect(
    page.locator('[role="menu"]').filter({ hasText: "Learn more" })
  ).toHaveCount(1);
  await page.evaluate(recordLayoutShifts, { key: SHIFTS, overlay: TOASTER });
  await page.locator(ACCOUNT_TRIGGER).click();
  const menuItem = page.getByRole("menuitem", { exact: true, name: item });
  await expect(menuItem).toBeVisible();

  const pressedAt = await page.evaluate(() => performance.now());
  await recordPaints(page, {
    contains: "",
    duration: RECORD_MILLISECONDS,
    selector: MAIN,
  });
  await menuItem.click();
  await expect(page).toHaveURL(path);
  await expect
    .poll(async () => (await readPaints(page)).at(-1)?.at ?? 0, {
      timeout: RECORD_MILLISECONDS * 4,
    })
    .toBeGreaterThanOrEqual(RECORD_MILLISECONDS);
  return pressedAt;
}

for (const destination of destinations) {
  test(`pressing ${destination.item} in the account menu leaves no blank frame and moves no layout`, async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(() => page.goto("/en/search"));
        const pressedAt = yield* Effect.promise(() =>
          pressAccountItem(page, destination.item, destination.path)
        );

        const summary = summarizePaints(
          yield* Effect.promise(() => readPaints(page))
        );
        expect(summary).toBeDefined();
        expect(summary?.emptyFrames).toBe(0);

        const shifts = yield* readRecordedLayoutShifts(page, SHIFTS);
        const moved = shifts
          .filter((shift) => !shift.hadRecentInput && shift.time >= pressedAt)
          .reduce((total, shift) => total + shift.value, 0);
        expect(moved).toBe(0);
      })
    );
  });
}
