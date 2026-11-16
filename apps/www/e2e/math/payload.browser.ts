import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Result } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { paginationNavigation, SUBJECT_LINK } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The scripts of a page that carry the router's data, the server component trees included. */
const STREAM_PART =
  /<script(?: data-tsr-stream-part="")?>(?<part>\$_TSR[\s\S]*?)<\/script>/gu;

/** A formula that KaTeX has drawn: its markup holds one visual part. */
const DRAWN_FORMULA = /katex-html/gu;

/** A formula that carries the markup the server drew, as the data names its prop. */
const CARRIED_MARKUP = /\\"markup\\":/gu;

/** How many times a pattern occurs across the page's data. */
const countIn = (data: readonly string[], pattern: RegExp) =>
  Arr.reduce(
    data,
    0,
    (count, part) => count + Arr.fromIterable(part.matchAll(pattern)).length
  );

/** The TeX of every formula the page's article draws, in order, as KaTeX's MathML copy names it. */
const drawnTex = () =>
  Array.from(
    document.querySelectorAll(
      'article [data-testid="katex"] annotation[encoding="application/x-tex"]'
    ),
    (annotation) => annotation.textContent
  );

/** How many formulas of the page's article hold no markup. */
const emptyFormulas = () =>
  Array.from(document.querySelectorAll('article [data-testid="katex"]')).filter(
    (formula) => formula.innerHTML === ""
  ).length;

/** Opens a lesson and waits until the router has committed it. */
const openLesson = Effect.fn("NakafaE2E.openMathLesson")(function* (
  page: Page,
  path: string
) {
  yield* Effect.promise(() => page.goto(path));
  yield* waitForCommittedAppRouter(
    page,
    path,
    path,
    readinessTimeoutMilliseconds
  );
});

/**
 * A lesson's data carries each formula's TeX, never KaTeX's markup: the server
 * draws the markup into the HTML once, and the browser keeps it as it hydrates.
 * Only a formula inside another renderer's prop, such as a scene's label that
 * mounts in a canvas overlay, carries the markup the server drew for it, so the
 * markup in the data is exactly those formulas' (ADR 0039 D13).
 */
const verifyLoadedLesson = Effect.fn("NakafaE2E.verifyLoadedMathLesson")(
  function* (page: Page) {
    const html = yield* Effect.promise(() =>
      page.request.get(pinnedRoutes.inverse.en).then((answer) => answer.text())
    );
    const data = Arr.filterMap(
      Arr.fromIterable(html.matchAll(STREAM_PART)),
      (match) =>
        match.groups?.part === undefined
          ? Result.failVoid
          : Result.succeed(match.groups.part)
    );
    yield* openLesson(page, pinnedRoutes.inverse.en);
    const tex = yield* Effect.promise(() => page.evaluate(drawnTex));
    const empty = yield* Effect.promise(() => page.evaluate(emptyFormulas));

    yield* Effect.sync(() => {
      expect(html).toContain('class="katex"');
      expect(data.length).toBeGreaterThan(0);
      expect(countIn(data, DRAWN_FORMULA)).toBe(countIn(data, CARRIED_MARKUP));
      expect(tex.length).toBeGreaterThan(0);
      expect(empty).toBe(0);
    });
  }
);

/**
 * A lesson reached by a client navigation draws its formulas in the browser,
 * each one whole as it mounts, since the navigation loads KaTeX before it shows
 * the page. They are that lesson's own formulas, as a load of it draws them,
 * never the markup the last lesson left in the same places. A move draws a long
 * body a few blocks a frame (`ContentBlocks`), and the router moves the address
 * before it commits the next page, so the check reads the formulas until the
 * whole lesson stands, never the last lesson or the first blocks alone.
 */
const verifyNavigatedLesson = Effect.fn("NakafaE2E.verifyNavigatedMathLesson")(
  function* (page: Page) {
    yield* openLesson(page, pinnedRoutes.inverse.en);
    const previous = paginationNavigation(page).locator(SUBJECT_LINK).first();
    const target = yield* Effect.promise(() => previous.getAttribute("href"));
    yield* Effect.sync(() => {
      expect(target).toBeTruthy();
      expect(target).not.toBe(pinnedRoutes.inverse.en);
    });

    const loaded = yield* Effect.promise(() => page.context().newPage());
    yield* openLesson(loaded, target ?? "");
    const drawn = yield* Effect.promise(() => loaded.evaluate(drawnTex));
    yield* Effect.promise(() => loaded.close());

    yield* Effect.promise(async () => {
      await previous.click();
      await expect
        .poll(() => page.evaluate(drawnTex), {
          timeout: readinessTimeoutMilliseconds,
        })
        .toEqual(drawn);
    });
    const empty = yield* Effect.promise(() => page.evaluate(emptyFormulas));

    yield* Effect.sync(() => {
      expect(drawn.length).toBeGreaterThan(0);
      expect(empty).toBe(0);
    });
  }
);

test.describe("Math payload", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("a lesson's data holds no KaTeX markup, and every formula keeps the server's", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyLoadedLesson(page))
    );
  });

  test("a lesson reached in the app draws every formula of its own", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyNavigatedLesson(page))
    );
  });
});
