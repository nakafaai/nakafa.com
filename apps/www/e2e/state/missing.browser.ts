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
import { waitUntilTakenOver } from "@/e2e/support/window";

const dictionaries = { de, en, id };

type Locale = keyof typeof dictionaries;

/**
 * An address that no page owns: a Quran surah that does not exist. The proxy
 * rejects it with a 404 whatever the content store holds, so the address needs
 * no data.
 */
const HARD_ADDRESS = "quran/999";

/**
 * An address that the Worker answers not found before any route renders: the
 * school tree on the main host. The Worker renders the app's not-found page at
 * the address itself, in the locale that its path names.
 */
const SCHOOL_TREE_ADDRESS = "school/anything";

/**
 * Where a page calls `notFound()` inside the app: a pagination query with only a
 * cursor, which the article catalog cannot decode. The catalog is a prerendered
 * page, and every address that the Worker answers as missing gets the standalone
 * page, so a reader reaches the app's own not-found page by a navigation in the
 * browser, as `openMissing` does.
 */
const SOFT_ADDRESS = "articles?cursor=x";

/** The prerendered page that the navigation to `SOFT_ADDRESS` starts from. */
const SOFT_SOURCE = "articles";

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

/**
 * Opens the app's own not-found page as a reader reaches it: the catalog loads,
 * React takes it over, and the router navigates in the browser to an address
 * whose loader answers not found.
 */
const openMissing = Effect.fn("NakafaE2E.openMissing")(function* (
  page: Page,
  locale: Locale,
  address: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* holdWebFont(page);
  const response = yield* Effect.promise(() =>
    page.goto(`/${locale}/${SOFT_SOURCE}`, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.status()).toBe(200));
  yield* Effect.promise(() =>
    waitUntilTakenOver(page.getByRole("heading", { level: 1 }))
  );
  yield* Effect.promise(() =>
    page.evaluate(
      (href) => window.__TSR_ROUTER__?.navigate({ href }),
      `/${locale}/${address}`
    )
  );
  yield* Effect.promise(() =>
    expect(page).toHaveURL(new URL(`/${locale}/${address}`, page.url()).href)
  );
});

/**
 * Opens the not-found page that the Worker answers, in one language, and waits
 * until React has taken it over: the browser hydrates the page that the server
 * sent at the same address, so a page drawn for another address would fail with
 * React #418 there.
 */
const openStandalone = Effect.fn("NakafaE2E.openStandalone")(function* (
  page: Page,
  locale: Locale
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* holdWebFont(page);
  const response = yield* Effect.promise(() =>
    page.goto(`/${locale}/${SCHOOL_TREE_ADDRESS}`, {
      waitUntil: "domcontentloaded",
    })
  );
  yield* Effect.sync(() => expect(response?.status()).toBe(404));
  yield* Effect.promise(() =>
    waitUntilTakenOver(
      page.getByRole("link", {
        exact: true,
        name: dictionaries[locale].State["home-button"],
      })
    )
  );
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
 * The addresses that the Worker answers with 404 before any route renders: a
 * school tree address on the main host, a removed route, and an unsupported
 * system resource. `answer.server.test.ts` checks which page answers each, and
 * the tests above check the not-found page itself, so here only the status is
 * checked.
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
