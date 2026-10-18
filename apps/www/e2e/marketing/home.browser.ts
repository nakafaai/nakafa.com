import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import {
  Array as Arr,
  Effect,
  MutableList,
  Number as Num,
  Schema,
} from "effect";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { withBrowserContext } from "@/e2e/support/context";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  readRecordedSizeChanges,
  recordSizeChanges,
} from "@/e2e/support/resize";
import { abortChunkHolding, openRoute } from "@/e2e/support/route";
import { isKnownSceneDiagnostic } from "@/e2e/support/scene";
import { scrollThroughPage } from "@/e2e/support/scroll";
import { TOASTER } from "@/e2e/support/selector";
import {
  desktopViewport,
  tabletPortraitViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** The parts of the home page, in the order of the page. */
const HOME_PARTS = [
  "hero",
  LESSON_SECTION_ID,
  "tryout",
  "nina",
  "memory",
  "privacy",
  "curricula",
  "letter",
  "medals",
  "pricing",
  "school",
  "faq",
  "community",
  "closing",
];

/** The widths the home page must hold at: a phone with touch, a tablet and a desktop. */
const HOME_VIEWPORTS = [touchViewport, tabletPortraitViewport, desktopViewport];

/** The two colour schemes the home page must hold in. */
const COLOR_SCHEMES = Schema.Literals(["light", "dark"]).literals;

/**
 * The page global that holds the layout shifts the page makes, with the elements
 * that moved, so a failure names them. A fixed toaster's shifts are left out.
 */
const LAYOUT_SHIFTS_KEY = "nakafaHomeLayoutShifts";

/** The page global that holds the size changes of the sections and the lesson window's panels. */
const SIZE_CHANGES_KEY = "nakafaHomeSizeChanges";

/** The sections of the page and the panels of the lesson window, whose sizes a failure names. */
const SIZED_ELEMENTS = "section[id], [role='tabpanel']";

/**
 * How far apart a resize and a layout shift may be and still be named together
 * in a failure. Timestamps cannot place a resize in its frame exactly, so this is
 * about three frames at 60 Hz: a resize in the frame before a shift is named too,
 * and the message lists candidate causes, not proven ones.
 */
const SHIFT_TOLERANCE_MILLISECONDS = 50;

/**
 * The start of a dot colour that only the particle field's code holds: the dark
 * theme paints its dots with it. The field loads while the hero hydrates.
 */
const PARTICLES_MARKER = "oklch(0.985 0 0 / ";

/** Collects the console errors and warnings a page writes, hydration warnings included. */
function observeConsole(page: Page) {
  const issues = MutableList.make<string>();
  page.on("console", (message) => {
    const type = message.type();
    const text = message.text();
    if (
      (type === "error" || type === "warning") &&
      !isKnownSceneDiagnostic(text)
    ) {
      MutableList.append(issues, `${type}: ${text}`);
    }
  });
  return issues;
}

for (const viewport of HOME_VIEWPORTS) {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`home page keeps still and quiet at ${viewport.name} in ${colorScheme}`, async ({
      baseURL,
      browser,
    }) => {
      expect(baseURL).toBeTruthy();
      await Effect.runPromise(
        withBrowserContext(
          browser,
          {
            baseURL: baseURL ?? "",
            colorScheme,
            hasTouch: viewport.hasTouch,
            reducedMotion: "no-preference",
            serviceWorkers: "block",
            viewport: viewportSize(viewport),
          },
          (context) =>
            Effect.gen(function* () {
              const page = yield* Effect.promise(() => context.newPage());
              const issues = observeConsole(page);
              yield* Effect.promise(() =>
                page.addInitScript(recordLayoutShifts, {
                  key: LAYOUT_SHIFTS_KEY,
                  overlay: TOASTER,
                })
              );
              yield* Effect.promise(() =>
                page.addInitScript(recordSizeChanges, {
                  key: SIZE_CHANGES_KEY,
                  selector: SIZED_ELEMENTS,
                })
              );
              yield* withObservedPageErrors(
                page,
                Effect.gen(function* () {
                  yield* openRoute(page, "/id", "denied");
                  yield* Effect.promise(() =>
                    page.waitForLoadState("networkidle")
                  );
                  yield* scrollThroughPage(page);
                  const shifts = yield* readRecordedLayoutShifts(
                    page,
                    LAYOUT_SHIFTS_KEY
                  );
                  const resizes = yield* readRecordedSizeChanges(
                    page,
                    SIZE_CHANGES_KEY
                  );
                  // The number and the failure message read the same shifts: the
                  // ones that no press or key caused, with the elements they moved
                  // and the elements that changed size near them in time.
                  const counted = Arr.filter(
                    shifts,
                    (shift) => !shift.hadRecentInput
                  );
                  const shift = Num.sumAll(
                    Arr.map(counted, ({ value }) => value)
                  );
                  const moved = Arr.map(counted, (entry) => {
                    const resized = Arr.filter(
                      resizes,
                      (resize) =>
                        Math.abs(resize.time - entry.time) <=
                        SHIFT_TOLERANCE_MILLISECONDS
                    );
                    const sized = Arr.map(
                      resized,
                      (resize) =>
                        `${resize.element} ${resize.width}x${resize.height} at ${Math.round(resize.time)} ms`
                    );
                    const named =
                      sized.length === 0
                        ? ""
                        : `; resized: ${Arr.join(sized, ", ")}`;
                    return `${entry.value} at ${Math.round(entry.time)} ms: ${Arr.join(entry.sources, "; ")}${named}`;
                  });
                  expect(shift, Arr.join(moved, "\n")).toBe(0);
                  expect(MutableList.toArray(issues)).toEqual([]);
                })
              );
            })
        )
      );
    });
  }
}

test("home page keeps the hero when the particle field fails to load", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(tabletPortraitViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              // The particle field's code fails while the page hydrates. The hero must stay, and no error page may replace it.
              const abortedParticles = yield* abortChunkHolding(
                page,
                PARTICLES_MARKER
              );
              yield* openRoute(page, "/en", "denied");
              // Waits for the page's requests to settle, so the aborted chunk has failed before the hero is checked.
              yield* Effect.promise(() => page.waitForLoadState("networkidle"));
              yield* Effect.sync(() =>
                expect(MutableList.toArray(abortedParticles)).not.toEqual([])
              );
              yield* Effect.promise(() =>
                expect(
                  page.getByRole("heading", { level: 1, name: en.Error.title })
                ).toHaveCount(0)
              );
              yield* Effect.promise(() =>
                expect(
                  page.locator("#hero").getByRole("heading", { level: 1 })
                ).toBeVisible()
              );
              yield* Effect.promise(() =>
                expect(page.locator("#hero canvas")).toHaveCount(0)
              );
            })
          );
        })
    )
  );
});

test("home page carries every part in Indonesian, English and German", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.forEach(["id", "en", "de"], (locale) =>
              Effect.gen(function* () {
                yield* openRoute(page, `/${locale}`, "denied");
                yield* Effect.promise(() =>
                  expect(page.locator("h1")).toBeVisible()
                );
                yield* Effect.forEach(HOME_PARTS, (part) =>
                  Effect.promise(() =>
                    expect(page.locator(`#${part}`)).toBeAttached()
                  )
                );
              })
            )
          );
        })
    )
  );
});
