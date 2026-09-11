import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const readinessTimeoutMilliseconds = 15_000;

const verifyCompactReferenceSheet = Effect.fn(
  "NakafaE2E.verifyCompactReferenceSheet"
)(function* (page: Page, href: string, width: number) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );

  const sidebarTrigger = page
    .getByRole("button", { exact: true, name: "Pada halaman ini" })
    .or(page.locator('header [data-slot="surah-header-actions"] button'))
    .filter({ visible: true });
  if (width < 1280) {
    yield* Effect.promise(() => sidebarTrigger.click());
  }

  const trigger = page.getByRole("button", {
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
        hasOverflow: item.scrollWidth > item.clientWidth,
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
      hasOverflow: false,
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
  });

  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(sheet).toHaveCount(0));
  yield* Effect.promise(() => expect(trigger).toBeFocused());
});

for (const width of [390, 665, 1440]) {
  test.describe(`bibliography at ${width}px`, () => {
    test.use({ viewport: { height: 957, width } });

    for (const href of [
      "/id/articles/politics/regional-elections-turmoil",
      "/id/quran/1",
    ]) {
      test(`presents ${href} references as a divided list`, async ({
        page,
      }) => {
        await Effect.runPromise(
          withObservedPageErrors(
            page,
            verifyCompactReferenceSheet(page, href, width)
          )
        );
      });
    }
  });
}
