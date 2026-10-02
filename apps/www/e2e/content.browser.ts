import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Page, test } from "@playwright/test";
import { Effect, Predicate, Schedule, Schema } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { pinnedRoutes } from "@/e2e/support/corpus";
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
type JsonLdType = "Article" | "LearningResource";
const dateLabels = {
  de: { published: "Veröffentlicht", updated: "Aktualisiert" },
  en: { published: "Published", updated: "Updated" },
  id: { published: "Diterbitkan", updated: "Diperbarui" },
} satisfies Record<AppLocaleCode, DateLabels>;

type LocalizedContentRoute = Readonly<{ href: string; locale: AppLocaleCode }>;

interface ContentRouteGroup {
  readonly jsonLdTypes: readonly JsonLdType[];
  readonly kind: "article" | "material";
  readonly routes: readonly LocalizedContentRoute[];
}

const contentRouteGroups = [
  {
    jsonLdTypes: ["Article", "LearningResource"],
    kind: "article",
    routes: [
      { href: pinnedRoutes.article.en, locale: "en" },
      { href: pinnedRoutes.article.id, locale: "id" },
      { href: pinnedRoutes.article.de, locale: "de" },
    ],
  },
  {
    jsonLdTypes: ["Article", "LearningResource"],
    kind: "material",
    routes: [
      { href: pinnedRoutes.material.en, locale: "en" },
      { href: pinnedRoutes.material.id, locale: "id" },
      { href: pinnedRoutes.material.de, locale: "de" },
    ],
  },
] satisfies readonly ContentRouteGroup[];

/** A rendered content page lost its expected structured-date contract. */
class ContentDateContractError extends Schema.TaggedError<ContentDateContractError>()(
  "ContentDateContractError",
  { href: Schema.String, surface: Schema.String }
) {}

function contentDateError(href: string, surface: string) {
  return new ContentDateContractError({ href, surface });
}

/** Reads one date-bearing JSON-LD node selected by its public schema type. */
const readJsonLdDates = Effect.fn("NakafaE2E.readJsonLdDates")(function* (
  page: Page,
  href: string,
  jsonLdType: JsonLdType
) {
  const { PublicationDatesSchema } = yield* Effect.tryPromise({
    catch: () => contentDateError(href, "publication date schema"),
    try: () => import("@nakafa/aksara-contracts/date"),
  });
  const nodes = yield* Effect.tryPromise({
    catch: () => contentDateError(href, `${jsonLdType} JSON-LD`),
    try: () =>
      page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts) =>
          scripts.map((script) => JSON.parse(script.textContent ?? "null"))
        ),
  });

  // The page context only exposes browser globals, so the narrow stays here.
  const [node] = nodes.filter(
    (value: unknown) =>
      Predicate.isObject(value) && Reflect.get(value, "@type") === jsonLdType
  );

  if (node === undefined) {
    return yield* contentDateError(href, `${jsonLdType} JSON-LD dates`);
  }

  const dateModified = Reflect.get(node, "dateModified");
  const datePublished = Reflect.get(node, "datePublished");
  const raw =
    dateModified === undefined
      ? { datePublished }
      : { dateModified, datePublished };

  return yield* Schema.decodeEffect(PublicationDatesSchema)(raw).pipe(
    Effect.mapError(() => contentDateError(href, `${jsonLdType} JSON-LD dates`))
  );
});

/** Proves one page's screen-reader dates match every structured-data surface. */
const expectTruthfulDates = Effect.fn("NakafaE2E.expectTruthfulDates")(
  function* (
    page: Page,
    route: LocalizedContentRoute,
    jsonLdTypes: readonly JsonLdType[]
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
        contentDateError(route.href, "semantic time elements")
      )
    );
    const expectedDates = yield* Effect.forEach(jsonLdTypes, (jsonLdType) =>
      readJsonLdDates(page, route.href, jsonLdType)
    );
    const firstDates = expectedDates[0];
    if (!firstDates) {
      return yield* contentDateError(route.href, "structured date types");
    }

    const blockText = yield* Effect.promise(() => dateBlock.textContent());
    const labels = dateLabels[route.locale];
    yield* Effect.sync(() => {
      for (const dates of expectedDates) {
        expect(dates).toEqual(firstDates);
      }
      expect(blockText).toContain(labels.published);
      expect(timeDates).toEqual(
        firstDates.dateModified === undefined
          ? [firstDates.datePublished]
          : [firstDates.datePublished, firstDates.dateModified]
      );
      if (firstDates.dateModified === undefined) {
        expect(blockText).not.toContain(labels.updated);
      } else {
        expect(blockText).toContain(labels.updated);
      }
    });
  }
);

const expectSingleLink = Effect.fn("NakafaE2E.expectSingleLink")(function* (
  page: Page,
  selector: string,
  href: string
) {
  const link = page.locator(selector);
  yield* Effect.promise(() => expect(link).toHaveCount(1));
  yield* Effect.promise(() => expect(link).toHaveAttribute("href", href));
});

const expectCanonicalAlternates = Effect.fn(
  "NakafaE2E.expectCanonicalAlternates"
)(function* (
  page: Page,
  route: LocalizedContentRoute,
  routes: readonly LocalizedContentRoute[]
) {
  yield* expectSingleLink(
    page,
    'link[rel="canonical"]',
    `${APP_ORIGIN}${route.href}`
  );
  for (const alternate of routes) {
    yield* expectSingleLink(
      page,
      `link[rel="alternate"][hreflang="${alternate.locale}"]`,
      `${APP_ORIGIN}${alternate.href}`
    );
  }
  const englishRoute = routes.find((alternate) => alternate.locale === "en");
  if (!englishRoute) {
    return yield* contentDateError(route.href, "x-default alternate");
  }
  yield* expectSingleLink(
    page,
    'link[rel="alternate"][hreflang="x-default"]',
    `${APP_ORIGIN}${englishRoute.href}`
  );
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
    return yield* contentDateError(route.href, "document response");
  }
  const html = yield* Effect.promise(() => response.text());
  yield* Effect.sync(() => {
    expect(response.status()).toBe(200);
    expect(html).toMatch(DOCUMENT_TITLE_PATTERN);
    expect(html).toMatch(DOCUMENT_SECTION_PATTERN);
  });
  yield* expectCanonicalAlternates(page, route, group.routes);
  yield* expectTruthfulDates(page, route, group.jsonLdTypes);

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
      recordedViews: Object.keys(views.state.viewedSlugs).length,
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
              const preferences = page
                .locator("footer")
                .getByRole("button", { name: "Usage data" });
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
