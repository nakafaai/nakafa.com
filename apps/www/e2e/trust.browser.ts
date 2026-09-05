import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const verifyAngleEditing = Effect.fn("NakafaE2E.verifyAngleEditing")(function* (
  card: Locator,
  angle: Locator,
  locale: AppLocaleCode
) {
  const formatter = new Intl.NumberFormat(locale);
  for (const value of [31.5, -30.5, 390.5]) {
    const formatted = formatter.format(value);
    yield* Effect.promise(() => angle.fill(formatted));
    yield* Effect.promise(() => angle.press("Tab"));
    yield* Effect.promise(() => expect(angle).toHaveValue(formatted));
    yield* Effect.promise(() => expect(card).toContainText(`Sin (${value}°)`));
    yield* Effect.promise(() => angle.fill(""));
    yield* Effect.promise(() => angle.press("Tab"));
    yield* Effect.promise(() => expect(angle).toHaveValue(formatted));
    yield* Effect.promise(() => expect(card).not.toContainText("NaN"));
    yield* Effect.promise(() => expect(card).toContainText(`Sin (${value}°)`));
  }
});

const verifyPublishedTrustLesson = Effect.fn(
  "NakafaE2E.verifyPublishedTrustLesson"
)(function* (page: Page, locale: AppLocaleCode) {
  yield* seedDeniedAnalyticsConsent(page);
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  yield* Effect.promise(() =>
    page.goto(`/${locale}`, { waitUntil: "domcontentloaded" })
  );
  const trust = page.locator("#trust").filter({ visible: true });
  const article = trust.locator("article");
  const source = trust.locator("aside code");
  yield* Effect.promise(() => expect(article.locator("h2")).toHaveCount(3));

  const headings = yield* Effect.promise(() =>
    article.locator("h2").allTextContents()
  );
  const paragraphs = yield* Effect.promise(() =>
    article.locator(":scope > div > p").allTextContents()
  );
  const sides = yield* Effect.promise(() =>
    article.locator(":scope > div > ol > li").allTextContents()
  );
  const rawMdx = yield* Effect.promise(() => source.textContent());
  yield* Effect.sync(() => {
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(sides).toHaveLength(3);
    for (const heading of headings) {
      expect(rawMdx).toContain(`## ${heading}`);
    }
    expect(rawMdx).toContain("<Triangle");
  });

  const angle = article.getByRole("textbox", {
    exact: true,
    name: messages.Common.angle,
  });
  yield* Effect.promise(() => angle.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => expect(angle).toHaveValue("30"));
  yield* Effect.promise(() =>
    expect(angle).toHaveAttribute(
      "aria-roledescription",
      messages.Common["number-field"]
    )
  );
  yield* Effect.promise(() =>
    article
      .getByRole("button", {
        exact: true,
        name: messages.Common["increase-angle"],
      })
      .click()
  );
  yield* Effect.promise(() => expect(angle).toHaveValue("31"));
  yield* Effect.promise(() =>
    article
      .getByRole("button", {
        exact: true,
        name: messages.Common["decrease-angle"],
      })
      .click()
  );
  yield* Effect.promise(() => expect(angle).toHaveValue("30"));
  yield* verifyAngleEditing(article, angle, locale);

  const lessonLink = trust.locator(
    '[data-trust-primary-pane] a[target="_blank"]'
  );
  const lessonHref = yield* Effect.promise(() =>
    lessonLink.getAttribute("href")
  );
  yield* Effect.promise(() =>
    expect(trust.locator('aside a[target="_blank"]')).toHaveAttribute(
      "href",
      `${lessonHref}.md`
    )
  );
  yield* Effect.acquireUseRelease(
    Effect.all(
      [
        Effect.promise(() => page.waitForEvent("popup")),
        Effect.promise(() => lessonLink.click()),
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.map(([lessonPage]) => lessonPage)),
    (lessonPage) =>
      withObservedPageErrors(
        lessonPage,
        Effect.gen(function* () {
          const learnerArticle = lessonPage.locator("article");
          yield* Effect.promise(() =>
            expect(learnerArticle.locator("h2")).toHaveText(headings)
          );
          yield* Effect.promise(() =>
            expect(learnerArticle.locator(":scope > p")).toHaveText(paragraphs)
          );
          yield* Effect.promise(() =>
            expect(learnerArticle.locator(":scope > ol > li")).toHaveText(sides)
          );
        })
      ),
    (lessonPage) => Effect.promise(() => lessonPage.close())
  );
});

test("trust uses the complete published lesson and localized controls in every app locale", async ({
  page,
}) => {
  const { APP_LOCALE_CODES } = await import("@nakafa/aksara-contracts/locale");
  for (const locale of APP_LOCALE_CODES) {
    await test.step(locale, () =>
      Effect.runPromise(
        withObservedPageErrors(page, verifyPublishedTrustLesson(page, locale))
      )
    );
  }
});

test("published unit-circle controls preserve finite angles after clearing", async ({
  page,
}) => {
  const { APP_LOCALE_CODES } = await import("@nakafa/aksara-contracts/locale");
  for (const locale of APP_LOCALE_CODES) {
    await test.step(locale, () =>
      Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* seedDeniedAnalyticsConsent(page);
            const messages = yield* Effect.promise(() =>
              loadLocaleMessages(locale)
            );
            yield* Effect.promise(() =>
              page.goto(
                `/${locale}/materials/mathematics/trigonometry/trigonometry-concept`,
                { waitUntil: "domcontentloaded" }
              )
            );
            const article = page.locator("article");
            const angles = article.getByRole("textbox", {
              exact: true,
              name: messages.Common.angle,
            });
            yield* Effect.promise(() => expect(angles).toHaveCount(2));
            // This signed lesson teaches the triangle before the unit circle.
            const angle = angles.last();
            const circle = article
              .locator('[data-slot="card"]')
              .filter({
                has: page.getByRole("textbox", {
                  exact: true,
                  name: messages.Common.angle,
                }),
              })
              .last();
            yield* Effect.promise(() => expect(circle).toHaveCount(1));
            yield* Effect.promise(() => angle.scrollIntoViewIfNeeded());
            yield* Effect.promise(() => expect(angle).toHaveValue("30"));
            yield* verifyAngleEditing(circle, angle, locale);
          })
        )
      )
    );
  }
});
