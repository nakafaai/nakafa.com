import { expect, type Page, type TestInfo, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A phone, a tablet and a desktop. */
const VIEWPORTS = [
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
] as const;

const SCHEMES = ["light", "dark"] as const;

/** How far apart the two names' centre lines may lie, in CSS px. */
const CENTRE_GAP_MAX = 1;

/** The surah list, and a surah whose header searches the others. */
const QURAN = "/en/quran";
const FATIHAH = "/en/quran/1";

/**
 * Runs in the page: for every Arabic name on screen that follows a Latin name
 * on the same line of its row, how far the Arabic name's centre line lies below the Latin one's.
 * A name's centre line is the middle of the band its script fills, from the
 * place each engine laid out its baseline: a Latin capital's height above the
 * baseline, and for the Arabic the whole reach of its face's letters, from the
 * hamza above alef to the tails of jim and mim. Both bands are measured from the
 * glyphs on a canvas in the face each name draws in, so the check holds in any
 * engine, whatever metrics that engine read from the face.
 */
function measureNames() {
  const canvas = document.createElement("canvas").getContext("2d");
  if (canvas === null) {
    return [];
  }
  const baselineOf = (element: Element) => {
    const probe = document.createElement("span");
    probe.style.cssText =
      "display:inline-block;width:0;height:0;vertical-align:baseline";
    element.prepend(probe);
    const baseline = probe.getBoundingClientRect().bottom;
    probe.remove();
    return baseline;
  };
  const centreOf = (element: Element, letters: string) => {
    const style = getComputedStyle(element);
    canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const ink = canvas.measureText(letters);
    return (
      baselineOf(element) -
      (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2
    );
  };
  return [...document.querySelectorAll('[lang="ar"]')].flatMap((arabic) => {
    const latin = arabic.previousElementSibling;
    if (
      latin === null ||
      latin.getAttribute("lang") === "ar" ||
      !arabic.checkVisibility() ||
      arabic.getBoundingClientRect().width <= 1
    ) {
      return [];
    }
    // A name sits beside its Latin name on one line; a verse under its heading does not.
    const arabicBox = arabic.getBoundingClientRect();
    const latinBox = latin.getBoundingClientRect();
    if (arabicBox.top >= latinBox.bottom || latinBox.top >= arabicBox.bottom) {
      return [];
    }
    return [
      {
        face: getComputedStyle(arabic).fontFamily,
        gap: centreOf(arabic, "أ ج م") - centreOf(latin, "H"),
        name: `${latin.textContent} ${arabic.textContent}`,
      },
    ];
  });
}

/** Waits until the page has drawn its names in their faces. */
const fontsReady = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(() => document.fonts.ready.then(() => true))
  );

/** Every name pair on screen whose centre lines lie apart, with how far. */
const unlevelNames = (page: Page) =>
  Effect.promise(() => page.evaluate(measureNames)).pipe(
    Effect.tap((names) =>
      Effect.sync(() => expect(names.length).toBeGreaterThan(0))
    ),
    Effect.map((names) =>
      Arr.filter(names, (name) => Math.abs(name.gap) > CENTRE_GAP_MAX)
    )
  );

/** Opens a page with its router hydrated and its faces drawn. */
const open = Effect.fn("NakafaE2E.openQuranNames")(function* (
  page: Page,
  href: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
  yield* fontsReady(page);
});

/** Attaches what the reader sees, for the pull request's screenshots. */
const attachView = (page: Page, testInfo: TestInfo, name: string) =>
  Effect.promise(() => page.screenshot()).pipe(
    Effect.andThen((body) =>
      Effect.promise(() =>
        testInfo.attach(name, { body, contentType: "image/png" })
      )
    )
  );

/**
 * A surah's Latin name and its Arabic name read as one line, level to the eye,
 * in every engine, at every width and in both themes: in the surah list, and in
 * the picker a surah page's header opens. The Arabic name draws in Amiri Quran's
 * line face, whose files carry its balanced metrics, so no engine sets its
 * baseline apart.
 */
for (const viewport of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    test(`surah names sit level with their Arabic names at ${viewport.width}px in ${scheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* open(page, QURAN);
            expect(yield* unlevelNames(page)).toEqual([]);
            yield* attachView(
              page,
              testInfo,
              `list-${viewport.width}-${scheme}`
            );

            yield* open(page, FATIHAH);
            yield* Effect.promise(() =>
              page
                .locator('[data-slot="page-header"]')
                .getByRole("button", { name: app.Holy["search-surah"] })
                .click()
            );
            yield* Effect.promise(() =>
              expect(page.getByRole("option").first()).toBeVisible()
            );
            yield* fontsReady(page);
            expect(yield* unlevelNames(page)).toEqual([]);
            yield* attachView(
              page,
              testInfo,
              `picker-${viewport.width}-${scheme}`
            );
          })
        )
      );
    });
  }
}
