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
  const list = sheet.locator('[data-slot="reference-list"]');
  const items = list.locator('[data-slot="reference-item"]');
  const itemCount = yield* Effect.promise(() => items.count());
  yield* Effect.sync(() => expect(itemCount).toBeGreaterThan(0));
  yield* Effect.promise(() =>
    expect(list.locator('[data-slot="separator"]')).toHaveCount(itemCount - 1)
  );
  yield* Effect.promise(() =>
    expect(list.locator('[data-slot="card"]')).toHaveCount(0)
  );

  const metrics = yield* Effect.promise(() =>
    items.first().evaluate((item) => {
      const itemStyle = getComputedStyle(item);
      const content = item.querySelector(
        '[data-slot="reference-item-content"]'
      );
      const contentStyle = content ? getComputedStyle(content) : null;
      const metadata = content?.lastElementChild;
      const title = item.querySelector("h3");
      const separator = item.querySelector('[data-slot="separator"]');
      const list = item.closest('[data-slot="reference-list"]');
      const url = item.querySelector("a");
      const urlStyle = url ? getComputedStyle(url) : null;

      return {
        contentGap: contentStyle?.gap,
        contentOverflowX: contentStyle?.overflowX,
        contentPaddingInline: contentStyle
          ? `${contentStyle.paddingLeft} ${contentStyle.paddingRight}`
          : null,
        dividerWidth: separator?.getBoundingClientRect().width,
        itemHeight: item.getBoundingClientRect().height,
        itemPaddingTop: itemStyle.paddingTop,
        listWidth: list?.getBoundingClientRect().width,
        metadataGap: metadata ? getComputedStyle(metadata).gap : null,
        titleFontSize: title ? getComputedStyle(title).fontSize : null,
        urlOverflowX: urlStyle?.overflowX,
        urlTextOverflow: urlStyle?.textOverflow,
      };
    })
  );
  yield* Effect.sync(() => {
    expect(metrics).toMatchObject({
      contentGap: "16px",
      contentOverflowX: "hidden",
      contentPaddingInline: "16px 16px",
      dividerWidth: metrics.listWidth,
      itemPaddingTop: "16px",
      metadataGap: "12px",
      titleFontSize: "14px",
      urlOverflowX: "hidden",
      urlTextOverflow: "ellipsis",
    });
    expect(metrics.itemHeight).toBeLessThanOrEqual(232);
  });

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(sheet).toHaveCount(0));
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

test.describe("article bibliography", () => {
  test.use({ viewport: { height: 957, width: 665 } });

  test("presents references as a compact divided list", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyCompactReferenceSheet(page))
    );
  });
});
