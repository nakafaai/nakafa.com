import type { PublicationDates } from "@nakafa/aksara-contracts/date";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Page, test } from "@playwright/test";
import { Effect, Record as Rec, Schedule, Schema } from "effect";
import { usageDataTrigger } from "@/e2e/support/consent";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import {
  expectSingleLink,
  readServerDocument,
  type ServerDocument,
} from "@/e2e/support/crawler";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const APP_ORIGIN = "https://nakafa.com";
const CLASS_SEPARATOR_PATTERN = /\s+/;
const DOCUMENT_TITLE_PATTERN = /<h1[\s>]/;
const DOCUMENT_SECTION_PATTERN = /<h2[\s>]/;
const STORED_DEVICE_PATTERN = /^".+"$/;
const CONTENT_VIEW_DEVICE_KEY = "nakafa-device-id";
const CONTENT_VIEWS_KEY = "nakafa-content-views";
/** Longer than the three-second engagement delay before a view counts. */
const ENGAGEMENT_DELAY_MS = 4000;
const ContentViewsRecord = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Struct({
      viewedSlugs: Schema.Record(Schema.String, Schema.Finite),
    }),
  })
);
type DateLabels = Readonly<{ published: string; updated: string }>;
const dateLabels = {
  de: { published: "Veröffentlicht", updated: "Aktualisiert" },
  en: { published: "Published", updated: "Updated" },
  id: { published: "Diterbitkan", updated: "Diperbarui" },
} satisfies Record<AppLocaleCode, DateLabels>;

type LocalizedContentRoute = Readonly<{ href: string; locale: AppLocaleCode }>;

interface ContentRouteGroup {
  readonly kind: "article" | "material";
  readonly routes: readonly LocalizedContentRoute[];
}

const contentRouteGroups = [
  {
    kind: "article",
    routes: [
      { href: pinnedRoutes.article.en, locale: "en" },
      { href: pinnedRoutes.article.id, locale: "id" },
      { href: pinnedRoutes.article.de, locale: "de" },
    ],
  },
  {
    kind: "material",
    routes: [
      { href: pinnedRoutes.material.en, locale: "en" },
      { href: pinnedRoutes.material.id, locale: "id" },
      { href: pinnedRoutes.material.de, locale: "de" },
    ],
  },
] satisfies readonly ContentRouteGroup[];

/** A rendered content page broke one of its SEO contracts. */
class ContentSeoContractError extends Schema.TaggedError<ContentSeoContractError>()(
  "ContentSeoContractError",
  { href: Schema.String, surface: Schema.String }
) {}

function contentSeoError(href: string, surface: string) {
  return new ContentSeoContractError({ href, surface });
}

const decodeJsonText = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Unknown)
);

/** Selects the page's own document among the site-wide JSON-LD scripts. */
const isArticleDocument = Schema.is(
  Schema.Tuple([
    Schema.Struct({ "@type": Schema.Literal("Article") }),
    Schema.Unknown,
  ])
);

/** Reads the page's one article document and holds it to the published contract. */
const readArticleJsonLd = Effect.fn("NakafaE2E.readArticleJsonLd")(function* (
  served: ServerDocument,
  href: string
) {
  const { ArticleJsonLdSchema } = yield* Effect.tryPromise({
    catch: () => contentSeoError(href, "article JSON-LD contract"),
    try: () => import("@repo/seo/json-ld/article"),
  });
  const documents = yield* Effect.forEach(served.jsonLd, (text) =>
    decodeJsonText(text).pipe(
      Effect.mapError(() => contentSeoError(href, "JSON-LD syntax"))
    )
  );
  const [articleDocument, ...duplicates] = documents.filter(isArticleDocument);
  if (articleDocument === undefined || duplicates.length > 0) {
    return yield* contentSeoError(href, "one article JSON-LD document");
  }

  return yield* Schema.decodeUnknownEffect(ArticleJsonLdSchema)(
    articleDocument,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() => contentSeoError(href, "article JSON-LD contract"))
  );
});

/** Proves the page's structured data names this page as its reader sees it. */
const expectArticleJsonLd = Effect.fn("NakafaE2E.expectArticleJsonLd")(
  function* (page: Page, route: LocalizedContentRoute, served: ServerDocument) {
    const [article, breadcrumb] = yield* readArticleJsonLd(served, route.href);
    // The headline must name the page as its reader sees it.
    const heading = yield* Effect.promise(() =>
      page.getByRole("heading", { level: 1 }).textContent()
    );
    const [home] = breadcrumb.itemListElement;
    const current = breadcrumb.itemListElement.at(-1);
    yield* Effect.sync(() => {
      expect(article.url).toBe(`${APP_ORIGIN}${route.href}`);
      expect(article.headline).toBe(heading);
      expect(article.description).toBe(served.description);
      expect(article.image).toBe(served.image);
      expect(article.inLanguage).toBe(route.locale);
      expect(served.language).toBe(route.locale);
      expect(home?.item).toBe(`${APP_ORIGIN}/${route.locale}`);
      expect(current?.name).toBe(heading);
    });
    return article;
  }
);

/** Proves one page's screen-reader dates match its structured data. */
const expectTruthfulDates = Effect.fn("NakafaE2E.expectTruthfulDates")(
  function* (
    page: Page,
    route: LocalizedContentRoute,
    structuredDates: PublicationDates
  ) {
    // Screen-reader prose stays accessible; pending streamed copies do not.
    const dateBlock = page
      .getByRole("paragraph")
      .filter({ has: page.locator("time[datetime]") });
    yield* Effect.promise(() => expect(dateBlock).toHaveCount(1));
    const style = yield* Effect.promise(() =>
      dateBlock.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          className: element.className,
          height: computed.height,
          overflow: computed.overflow,
          position: computed.position,
          width: computed.width,
        };
      })
    );
    yield* Effect.sync(() => {
      expect(style.className.split(CLASS_SEPARATOR_PATTERN)).toContain(
        "sr-only"
      );
      expect(style).toMatchObject({
        height: "1px",
        overflow: "hidden",
        position: "absolute",
        width: "1px",
      });
    });

    const rawTimeDates = yield* Effect.promise(() =>
      dateBlock
        .locator("time[datetime]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("datetime"))
        )
    );
    const timeDates = yield* Schema.decodeUnknownEffect(
      Schema.Array(Schema.String)
    )(rawTimeDates).pipe(
      Effect.mapError(() =>
        contentSeoError(route.href, "semantic time elements")
      )
    );
    const blockText = yield* Effect.promise(() => dateBlock.textContent());
    const labels = dateLabels[route.locale];
    yield* Effect.sync(() => {
      expect(blockText).toContain(labels.published);
      expect(timeDates).toEqual(
        structuredDates.dateModified === undefined
          ? [structuredDates.datePublished]
          : [structuredDates.datePublished, structuredDates.dateModified]
      );
      if (structuredDates.dateModified === undefined) {
        expect(blockText).not.toContain(labels.updated);
      } else {
        expect(blockText).toContain(labels.updated);
      }
    });
  }
);

const expectCanonicalAlternates = Effect.fn(
  "NakafaE2E.expectCanonicalAlternates"
)(function* (
  served: ServerDocument,
  route: LocalizedContentRoute,
  routes: readonly LocalizedContentRoute[]
) {
  const englishRoute = routes.find((alternate) => alternate.locale === "en");
  if (!englishRoute) {
    return yield* contentSeoError(route.href, "x-default alternate");
  }
  yield* Effect.sync(() => {
    expectSingleLink(served, "canonical", null, `${APP_ORIGIN}${route.href}`);
    for (const alternate of routes) {
      expectSingleLink(
        served,
        "alternate",
        alternate.locale,
        `${APP_ORIGIN}${alternate.href}`
      );
    }
    expectSingleLink(
      served,
      "alternate",
      "x-default",
      `${APP_ORIGIN}${englishRoute.href}`
    );
  });
});

const verifyContentRoute = Effect.fn("NakafaE2E.verifyContentRoute")(function* (
  page: Page,
  route: LocalizedContentRoute,
  group: ContentRouteGroup
) {
  const response = yield* Effect.promise(() =>
    page.goto(route.href, { waitUntil: "domcontentloaded" })
  );
  if (!response) {
    return yield* contentSeoError(route.href, "document response");
  }
  const html = yield* Effect.promise(() => response.text());
  yield* Effect.sync(() => {
    expect(response.status()).toBe(200);
    expect(html).toMatch(DOCUMENT_TITLE_PATTERN);
    expect(html).toMatch(DOCUMENT_SECTION_PATTERN);
  });
  // Crawlers read the HTML the server returns, so the head links and the
  // structured data are held to that document, not to the hydrating page.
  const served = yield* readServerDocument(page, html);
  yield* expectCanonicalAlternates(served, route, group.routes);
  const article = yield* expectArticleJsonLd(page, route, served);
  yield* expectTruthfulDates(page, route, article);

  if (group.kind !== "material") {
    return;
  }
  yield* waitForCommittedAppRouter(page, route.href, route.href, 15_000);
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="line-scene"]') })
    .filter({ visible: true })
    .first();
  const scene = card.locator('[data-slot="line-scene"]');
  const canvases = page.locator("canvas");
  yield* Effect.promise(() => expect(scene).toBeAttached());
  yield* Effect.promise(() => expect(canvases).toHaveCount(0));
  // Reveal the content-visibility card before scrolling its deferred scene.
  yield* Effect.promise(() =>
    expect(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(scene).toBeVisible();
      await scene.scrollIntoViewIfNeeded();
      expect(await scene.locator("canvas").isVisible()).toBe(true);
    }).toPass({ timeout: 30_000 })
  );
});

for (const group of contentRouteGroups) {
  test(`${group.kind} SEO contracts agree across EN, ID, and DE`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          serviceWorkers: "block",
          viewport: {
            height: group.kind === "material" ? 200 : 900,
            width: 1440,
          },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                for (const route of group.routes) {
                  yield* verifyContentRoute(page, route, group);
                }
              })
            );
          })
      )
    );
  });
}

/** Reads the identifier and the recorded-view count a content view leaves behind. */
const readContentViewStorage = Effect.fn("NakafaE2E.readContentViewStorage")(
  function* (page: Page) {
    const stored = yield* Effect.promise(() =>
      page.evaluate(
        ([deviceKey, viewsKey]) => ({
          deviceId: localStorage.getItem(deviceKey),
          views: localStorage.getItem(viewsKey),
        }),
        [CONTENT_VIEW_DEVICE_KEY, CONTENT_VIEWS_KEY] as const
      )
    );
    if (stored.views === null) {
      return { deviceId: stored.deviceId, recordedViews: 0 };
    }
    const views = yield* Schema.decodeEffect(ContentViewsRecord)(stored.views);
    return {
      deviceId: stored.deviceId,
      recordedViews: Rec.keys(views.state.viewedSlugs).length,
    };
  }
);

/** Opens one page and waits until hydration lets it record a view. */
const openPage = Effect.fn("NakafaE2E.openPage")(function* (
  page: Page,
  href: string
) {
  const response = yield* Effect.promise(() => page.goto(href));
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(page, href, href, 15_000);
});

/** The browser has not recorded the expected number of content views yet. */
class RecordedViewsPending extends Schema.TaggedError<RecordedViewsPending>()(
  "RecordedViewsPending",
  { recordedViews: Schema.Finite }
) {}

/** Reads the content-view storage once it holds the expected recorded views. */
const readRecordedViews = Effect.fn("NakafaE2E.readRecordedViews")(function* (
  page: Page,
  recordedViews: number
) {
  const storage = yield* readContentViewStorage(page);
  if (storage.recordedViews !== recordedViews) {
    return yield* new RecordedViewsPending({
      recordedViews: storage.recordedViews,
    });
  }
  return storage;
});

/** Passes the engagement delay, then waits until the view is recorded. */
const waitForRecordedViews = Effect.fn("NakafaE2E.waitForRecordedViews")(
  function* (page: Page, recordedViews: number) {
    yield* Effect.promise(() => page.clock.fastForward(ENGAGEMENT_DELAY_MS));
    return yield* readRecordedViews(page, recordedViews).pipe(
      Effect.retry({ schedule: Schedule.spaced("250 millis"), times: 60 })
    );
  }
);

test("content views store no device identifier until analytics is allowed", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() => page.clock.install());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openPage(page, pinnedRoutes.article.en);
              const prompt = page.getByRole("region", { name: "Usage data" });
              // The open prompt proves consent settled undecided.
              yield* Effect.promise(() => expect(prompt).toBeVisible());
              yield* Effect.promise(() =>
                page.clock.fastForward(ENGAGEMENT_DELAY_MS)
              );
              const undecided = yield* readContentViewStorage(page);
              yield* Effect.sync(() =>
                expect(undecided).toEqual({ deviceId: null, recordedViews: 0 })
              );

              yield* Effect.promise(() =>
                prompt.getByRole("button", { name: "Allow" }).click()
              );
              const allowed = yield* waitForRecordedViews(page, 1);
              yield* Effect.sync(() =>
                expect(allowed.deviceId).toMatch(STORED_DEVICE_PATTERN)
              );

              yield* openPage(page, pinnedRoutes.material.en);
              const nextPage = yield* waitForRecordedViews(page, 2);
              yield* Effect.sync(() =>
                expect(nextPage.deviceId).toBe(allowed.deviceId)
              );

              // Declining from a page without a content view still clears it.
              yield* openPage(page, "/en");
              const preferences = usageDataTrigger(page);
              yield* Effect.promise(() => preferences.click());
              yield* Effect.promise(() =>
                page.getByRole("button", { name: "Decline" }).click()
              );
              yield* Effect.promise(() =>
                expect
                  .poll(() =>
                    page.evaluate(
                      (deviceKey) => localStorage.getItem(deviceKey),
                      CONTENT_VIEW_DEVICE_KEY
                    )
                  )
                  .toBeNull()
              );
            })
          );
        })
    )
  );
});
