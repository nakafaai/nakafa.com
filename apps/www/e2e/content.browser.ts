import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Page, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "./support/browser-context";

const APP_ORIGIN = "https://nakafa.com";
const CLASS_SEPARATOR_PATTERN = /\s+/;
const RenderedDatesSchema = Schema.Struct({
  dateModified: Schema.optionalKey(Schema.String),
  datePublished: Schema.String,
});
interface DateLabels {
  readonly published: string;
  readonly updated: string;
}
type JsonLdType = "Article" | "LearningResource";
const dateLabels = {
  de: { published: "Veröffentlicht", updated: "Aktualisiert" },
  en: { published: "Published", updated: "Updated" },
  id: { published: "Diterbitkan", updated: "Diperbarui" },
} satisfies Record<AppLocaleCode, DateLabels>;

interface LocalizedContentRoute {
  readonly href: string;
  readonly locale: AppLocaleCode;
}

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
      {
        href: "/en/articles/politics/regional-elections-turmoil",
        locale: "en",
      },
      {
        href: "/id/articles/politics/regional-elections-turmoil",
        locale: "id",
      },
      {
        href: "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen",
        locale: "de",
      },
    ],
  },
  {
    jsonLdTypes: ["Article", "LearningResource"],
    kind: "material",
    routes: [
      {
        href: "/en/subjects/mathematics/analytic-geometry/hyperbola",
        locale: "en",
      },
      {
        href: "/id/materi/matematika/geometri-analitik/hiperbola",
        locale: "id",
      },
      {
        href: "/de/faecher/mathematik/analytische-geometrie/hyperbel",
        locale: "de",
      },
    ],
  },
] satisfies readonly ContentRouteGroup[];

/** A rendered content page lost its expected structured-date contract. */
class ContentDateContractError extends Schema.TaggedError<ContentDateContractError>()(
  "ContentDateContractError",
  { href: Schema.String, surface: Schema.String }
) {}

/** Reads one date-bearing JSON-LD node selected by its public schema type. */
const readJsonLdDates = Effect.fn("NakafaE2E.readJsonLdDates")(function* (
  page: Page,
  href: string,
  jsonLdType: JsonLdType
) {
  const raw = yield* Effect.tryPromise({
    catch: () =>
      new ContentDateContractError({ href, surface: `${jsonLdType} JSON-LD` }),
    try: () =>
      page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts, expectedType) => {
          for (const script of scripts) {
            const value: unknown = JSON.parse(script.textContent ?? "null");
            if (
              typeof value !== "object" ||
              value === null ||
              Array.isArray(value) ||
              Reflect.get(value, "@type") !== expectedType
            ) {
              continue;
            }
            return value;
          }
          return null;
        }, jsonLdType),
  });

  return yield* Schema.decodeUnknownEffect(RenderedDatesSchema)(raw).pipe(
    Effect.mapError(
      () =>
        new ContentDateContractError({
          href,
          surface: `${jsonLdType} JSON-LD dates`,
        })
    )
  );
});

/** Proves one page's screen-reader dates match every structured-data surface. */
const expectTruthfulDates = Effect.fn("NakafaE2E.expectTruthfulDates")(
  function* (
    page: Page,
    route: LocalizedContentRoute,
    jsonLdTypes: readonly JsonLdType[]
  ) {
    const dateBlock = page.locator("p.sr-only:has(time[datetime])");
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
      Effect.mapError(
        () =>
          new ContentDateContractError({
            href: route.href,
            surface: "semantic time elements",
          })
      )
    );
    const expectedDates = yield* Effect.forEach(jsonLdTypes, (jsonLdType) =>
      readJsonLdDates(page, route.href, jsonLdType)
    );
    const firstDates = expectedDates[0];
    if (!firstDates) {
      return yield* new ContentDateContractError({
        href: route.href,
        surface: "structured date types",
      });
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
    return yield* new ContentDateContractError({
      href: route.href,
      surface: "x-default alternate",
    });
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
  yield* Effect.sync(() => expect(response?.status()).toBe(200));
  yield* expectCanonicalAlternates(page, route, group.routes);
  yield* expectTruthfulDates(page, route, group.jsonLdTypes);

  if (group.kind !== "material") {
    return;
  }
  const canvases = page.locator("canvas");
  yield* Effect.promise(() => expect(canvases).toHaveCount(0));
  yield* Effect.promise(() => page.keyboard.press("End"));
  yield* Effect.promise(() =>
    expect(canvases.first()).toBeVisible({ timeout: 30_000 })
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
          viewport: { height: 900, width: 1440 },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.forEach(
                group.routes,
                (route) => verifyContentRoute(page, route, group),
                { concurrency: 1, discard: true }
              )
            );
          })
      )
    );
  });
}
