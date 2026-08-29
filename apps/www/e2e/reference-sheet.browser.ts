import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const articleHref = "/id/articles/politics/regional-elections-turmoil";
const readinessTimeoutMilliseconds = 15_000;

const verifyCompactReferenceSheet = Effect.fn(
  "NakafaE2E.verifyCompactReferenceSheet"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(articleHref, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    articleHref,
    articleHref,
    readinessTimeoutMilliseconds
  );

  const rightSidebar = page.locator("aside").filter({
    has: page.locator('[data-slot="sidebar"][data-side="right"]'),
  });
  const sidebarTrigger = rightSidebar.getByRole("button", {
    exact: true,
    name: "Toggle Sidebar",
  });
  yield* Effect.promise(() => expect(sidebarTrigger).toBeVisible());
  yield* Effect.promise(() => sidebarTrigger.click());

  const mobileSidebar = page
    .locator('[role="dialog"][data-sidebar="sidebar"]')
    .filter({ visible: true });
  yield* Effect.promise(() => expect(mobileSidebar).toBeVisible());
  const trigger = mobileSidebar.getByRole("button", {
    exact: true,
    name: "Daftar pustaka",
  });
  yield* Effect.promise(() => expect(trigger).toBeVisible());
  yield* Effect.promise(() => trigger.click());

  const sheet = page.locator('[data-slot="sheet-popup"]');
  yield* Effect.promise(() =>
    expect(sheet).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  const cards = sheet.locator('[data-slot="card"]');
  yield* Effect.promise(() => expect(cards).toHaveCount(11));

  const metrics = yield* Effect.promise(() =>
    cards.first().evaluate((card) => {
      const cardStyle = getComputedStyle(card);
      const content = card.querySelector('[data-slot="card-content"]');
      const contentStyle = content ? getComputedStyle(content) : null;
      const title = card.querySelector('[data-slot="card-title"]');

      return {
        cardGap: cardStyle.gap,
        cardHeight: card.getBoundingClientRect().height,
        cardPaddingBlock: `${cardStyle.paddingTop} ${cardStyle.paddingBottom}`,
        contentGap: contentStyle?.gap,
        titleFontSize: title ? getComputedStyle(title).fontSize : null,
      };
    })
  );
  yield* Effect.sync(() => {
    expect(metrics).toMatchObject({
      cardGap: "16px",
      cardPaddingBlock: "16px 16px",
      contentGap: "12px",
      titleFontSize: "14px",
    });
    expect(metrics.cardHeight).toBeLessThanOrEqual(248);
  });

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(sheet).toHaveCount(0));
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

test.describe("article bibliography", () => {
  test.use({ viewport: { height: 957, width: 665 } });

  test("keeps reference cards compact in the side sheet", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyCompactReferenceSheet(page))
    );
  });
});
