import { expect, type Page, test } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/standalone/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/standalone/id.json" with {
  type: "json",
};
import { Effect } from "effect";
import { FIGURE_WIDTH } from "@/components/state/size";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  expectState,
  expectThings,
  giveRoom,
  holdWebFont,
} from "@/e2e/support/state";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  compactViewport,
  desktopViewport,
  targetViewports,
  touchViewport,
} from "@/e2e/support/viewport";

const dictionaries = { de, en, id };

type Locale = keyof typeof dictionaries;

/**
 * An address that no page owns: a Quran surah that does not exist. The proxy
 * rejects it with a 404 whatever the content store holds, so the address needs
 * no data, and rewrites the request to the standalone page.
 */
const HARD_ADDRESS = "quran/999";

/**
 * Where the standalone page itself answers, and the request header in which
 * the proxy names the language when it rewrites an address to it. The rewrite
 * reaches the page. The server of a local production build, which
 * these tests run against, draws the app's own document only at this address
 * and answers the rewrite with the framework's built-in page; `main` did the
 * same when this was measured on 13 October 2026. So the tests ask for the
 * address itself, with the header that the proxy would set.
 */
const STANDALONE_ADDRESS = "/_missing";
const LOCALE_HEADER = "x-nakafa-locale";

/**
 * Where a page calls `notFound()` after the proxy let the request in: a
 * pagination query with only a cursor, which the article catalog cannot decode.
 * The app's own not-found page answers it, and its status depends on whether
 * the stream had started, so only the page is checked.
 */
const SOFT_ADDRESS = "articles?cursor=x";

/**
 * The narrowest window the page must hold. It is narrower than Nina and the
 * margins the page keeps around her, so she is cut at the sides there, and the
 * page still never scrolls sideways.
 */
const narrowViewport = {
  hasTouch: false,
  height: 800,
  name: "narrow",
  width: 200,
} as const;

/** The mark that a document keeps only while it is not loaded again. */
const STAYED = "nakafaStayed";

const openMissing = Effect.fn("NakafaE2E.openMissing")(function* (
  page: Page,
  locale: Locale,
  address: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* holdWebFont(page);
  return yield* Effect.promise(() =>
    page.goto(`/${locale}/${address}`, { waitUntil: "domcontentloaded" })
  );
});

/** Opens the standalone page as the proxy's rewrite does, in one language. */
const openStandalone = Effect.fn("NakafaE2E.openStandalone")(function* (
  page: Page,
  locale: Locale
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* holdWebFont(page);
  yield* Effect.promise(() =>
    page.setExtraHTTPHeaders({ [LOCALE_HEADER]: locale })
  );
  const response = yield* Effect.promise(() =>
    page.goto(STANDALONE_ADDRESS, { waitUntil: "domcontentloaded" })
  );
  // Only the document carries the header: what the page asks for next does not.
  yield* Effect.promise(() => page.setExtraHTTPHeaders({}));
  yield* Effect.sync(() => expect(response?.status()).toBe(404));
});

/**
 * The state of a page that cannot be found: one Nina, searching, a title, one
 * sentence and two ways on, in the room the window has, with nothing moving
 * and nothing wider than the window.
 */
const expectMissingState = Effect.fn("NakafaE2E.expectMissingState")(function* (
  page: Page,
  locale: Locale
) {
  const { NotFound: words, State: state } = dictionaries[locale];

  yield* Effect.promise(() =>
    expect(page.locator("html")).toHaveAttribute("lang", locale)
  );
  yield* Effect.promise(() =>
    expect(
      page.locator('meta[name="robots"][content*="noindex"]').first()
    ).toBeAttached()
  );
  yield* expectState(page, {
    description: words.description,
    links: [
      { href: `/${locale}`, label: state["home-button"] },
      { href: `/${locale}/search`, label: words["search-button"] },
    ],
    title: words.title,
  });
});

for (const viewport of [narrowViewport, ...targetViewports]) {
  test.describe(`the standalone state of a missing page at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the standalone page answers 404 with Nina searching", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* openStandalone(page, "en");
            yield* expectMissingState(page, "en");
          })
        )
      );
    });
  });
}

test("an address that no page owns is answered with 404 in every language", async ({
  request,
}) => {
  for (const locale of ["de", "en", "id"] as const) {
    const response = await request.get(`/${locale}/${HARD_ADDRESS}`);
    expect(response.status(), locale).toBe(404);
  }
});

for (const viewport of [touchViewport, desktopViewport]) {
  test.describe(`the state of a page that calls notFound at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the app's own not-found page shows the same state", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* openMissing(page, "en", SOFT_ADDRESS);
            yield* expectMissingState(page, "en");
          })
        )
      );
    });
  });
}

test.describe("the ways on from the app's own not-found page", () => {
  test.use({
    hasTouch: desktopViewport.hasTouch,
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("navigate inside the app, so the page around them stays loaded", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* openMissing(page, "en", SOFT_ADDRESS);
          yield* waitForCommittedAppRouter(
            page,
            `/en/${SOFT_ADDRESS}`,
            "/en",
            readinessTimeoutMilliseconds
          );
          // A document that loads again loses this mark, and a navigation
          // inside the app keeps it.
          yield* Effect.promise(() =>
            page.evaluate((key) => Reflect.set(window, key, true), STAYED)
          );

          yield* Effect.promise(() =>
            page
              .getByRole("link", { exact: true, name: en.State["home-button"] })
              .click()
          );
          yield* Effect.promise(() => page.waitForURL("**/en"));

          const stayed = yield* Effect.promise(() =>
            page.evaluate((key) => Reflect.get(window, key), STAYED)
          );
          yield* Effect.sync(() => expect(stayed).toBe(true));
        })
      )
    );
  });
});

test.describe("the state of a missing page in Indonesian", () => {
  test.use({
    hasTouch: desktopViewport.hasTouch,
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("speaks the language of the address", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* openStandalone(page, "id");
          yield* expectMissingState(page, "id");

          yield* openMissing(page, "id", SOFT_ADDRESS);
          yield* expectMissingState(page, "id");
        })
      )
    );
  });
});

test.describe("the state of a missing page in German at the narrowest width", () => {
  test.use({
    hasTouch: compactViewport.hasTouch,
    viewport: { height: compactViewport.height, width: compactViewport.width },
  });

  test("holds the longest words of the three languages with both ways on shown", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* openStandalone(page, "de");
          yield* expectMissingState(page, "de");
        })
      )
    );
  });
});

/**
 * Opens an address as a visitor types it, with no locale added, so the proxy
 * answers it and negotiates the language of the page that it rewrites to.
 */
const openAddress = Effect.fn("NakafaE2E.openAddress")(function* (
  page: Page,
  address: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* holdWebFont(page);
  return yield* Effect.promise(() =>
    page.goto(address, { waitUntil: "domcontentloaded" })
  );
});

/**
 * The addresses that the proxy answers with 404 before any page renders: a school
 * tree address on the main host, a removed route, and an unsupported system
 * resource. The proxy rewrites each to the app's not-found page,
 * which `proxy.test.ts` checks; a local production build draws the framework's
 * page for a rewrite, as `STANDALONE_ADDRESS` explains, so here only the status
 * is checked, and the tests above check the page that the rewrite reaches.
 */
const PROXY_ANSWERS = [
  "/school",
  "/school/anything",
  "/en/events",
  "/missing-machine-document.xml",
];

for (const address of PROXY_ANSWERS) {
  test(`${address} answers 404`, async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const response = yield* openAddress(page, address);
          yield* Effect.sync(() => expect(response?.status()).toBe(404));
        })
      )
    );
  });
}

test.describe("the things beside Nina on the state of a missing page", () => {
  test.use({
    hasTouch: touchViewport.hasTouch,
    viewport: { height: touchViewport.height, width: touchViewport.width },
  });

  test("show exactly when the three fit side by side", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* openStandalone(page, "en");

          yield* Effect.forEach(
            [
              { room: FIGURE_WIDTH - 1, shown: false },
              { room: FIGURE_WIDTH, shown: true },
            ],
            ({ room, shown }) =>
              giveRoom(page, room).pipe(
                Effect.andThen(expectThings(page, shown))
              ),
            { discard: true }
          );
        })
      )
    );
  });
});
