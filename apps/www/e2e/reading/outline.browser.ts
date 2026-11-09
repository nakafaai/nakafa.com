import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A desktop wide enough for the outline to stand beside the lesson. */
test.use({ viewport: { height: 900, width: 1440 } });

/** The links of the lesson's outline, in the panel beside it. */
const OUTLINE_LINKS =
  '[data-side="right"] [data-slot="sidebar-content"] a[href^="#"]';

/** The page's header, which stays on screen while the lesson scrolls under it. */
const PAGE_HEADER = '[data-slot="page-header"]';

/**
 * A long lesson whose outline nests a section's first subsection a few lines under
 * the section's own heading, as the lessons the owner reads on Windows do.
 */
const LESSON = pinnedRoutes.growth.en;

/** Windows' display scales, which leave scroll offsets and heading edges between device pixels. */
const DISPLAY_SCALES = [1.25, 1.5] as const;

/** One notch of a mouse wheel, as Windows scrolls it. */
const WHEEL_NOTCH = 100;

/**
 * Reads the section being read where the page stands, and the entry the outline
 * marks. The section being read is the last heading, in outline order, whose top
 * has passed the line where a jump to it stops (its scroll margin, and never above
 * the page header), or the last heading on screen when the page cannot scroll
 * further. The marked entry must also stand inside the outline's own scroller.
 */
const readOutline = (page: Page) =>
  page.evaluate(
    ({ header, links }) => {
      const anchors = [...document.querySelectorAll(links)].filter(
        (link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement
      );
      const headerBottom =
        document.querySelector(header)?.getBoundingClientRect().bottom ?? 0;
      const root = document.documentElement;
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 6;
      const passed = anchors.filter((link) => {
        const heading = document.querySelector(
          `#${CSS.escape(link.hash.slice(1))}`
        );
        if (heading === null || heading.getClientRects().length === 0) {
          return false;
        }
        const box = heading.getBoundingClientRect();
        const line =
          Math.max(
            headerBottom,
            Number.parseFloat(getComputedStyle(heading).scrollMarginTop)
          ) + 1;
        return atEnd ? box.top < window.innerHeight : box.top <= line;
      });
      const marked = anchors.filter(
        (link) => link.getAttribute("data-active") === "true"
      );
      const scroller = marked[0]?.closest('[data-slot="scroll-area-viewport"]');
      const entry = marked[0]?.getBoundingClientRect();
      const frame = scroller?.getBoundingClientRect();
      return {
        marked: marked.map((link) => link.hash),
        reading: passed.slice(-1).map((link) => link.hash),
        shown:
          entry === undefined ||
          frame === undefined ||
          (entry.top >= frame.top - 1 && entry.bottom <= frame.bottom + 1),
        top: root.scrollTop,
      };
    },
    { header: PAGE_HEADER, links: OUTLINE_LINKS }
  );

/**
 * Waits until the outline marks exactly the section being read, one entry and no
 * more, in sight inside its panel. It names what the outline marked otherwise.
 */
const expectFollows = (page: Page) =>
  Effect.promise(() =>
    expect
      .poll(
        async () => {
          const read = await readOutline(page);
          const marked = Arr.join(read.marked, " ");
          const reading = Arr.join(read.reading, " ");
          return read.shown && marked === reading
            ? "follows"
            : `at ${read.top} px the outline marks "${marked}" while "${reading}" is read, in sight ${read.shown}`;
        },
        { timeout: 3000 }
      )
      .toBe("follows")
  );

/** Every outline link whose heading the page does not hold. */
const unmatchedLinks = (page: Page) =>
  page
    .locator(OUTLINE_LINKS)
    .evaluateAll((links) =>
      links
        .filter(
          (link) =>
            link instanceof HTMLAnchorElement &&
            document.querySelector(`#${CSS.escape(link.hash.slice(1))}`) ===
              null
        )
        .map((link) => link.getAttribute("href"))
    );

/** Opens the lesson, waits until React holds it, and returns how far it scrolls. */
const openLesson = Effect.fn("NakafaE2E.openOutlineLesson")(function* (
  page: Page,
  baseURL: string | undefined
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() =>
    page.goto(`${baseURL ?? ""}${LESSON}`, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    LESSON,
    LESSON,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() =>
    expect(page.locator(OUTLINE_LINKS).first()).toBeVisible()
  );
  return yield* Effect.promise(() =>
    page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    )
  );
});

/**
 * A reader scrolls a long lesson down to its end and back up to its start. At
 * every step the outline marks the section being read, one entry and no more,
 * and keeps it in sight inside its panel. A heading that mounts as the reader
 * nears its section joins as soon as it draws, and every entry links to a
 * heading the page holds.
 */
test("the outline marks the section being read at every step down and up a long lesson", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const height = yield* openLesson(page, baseURL);
        const step = yield* Effect.promise(() =>
          page.evaluate(() => Math.round(window.innerHeight / 3))
        );
        const down = Arr.makeBy(
          Math.ceil(height / step) + 1,
          (index) => index * step
        );

        yield* Effect.forEach(
          Arr.appendAll(down, Arr.reverse(down)),
          (top) =>
            Effect.promise(() =>
              page.evaluate(
                (to) => window.scrollTo({ behavior: "instant", top: to }),
                top
              )
            ).pipe(Effect.andThen(expectFollows(page))),
          { discard: true }
        );

        expect(yield* Effect.promise(() => unmatchedLinks(page))).toEqual([]);
      })
    )
  );
});

/**
 * Chromium as Windows runs it: a wheel notch animates the page in smooth steps,
 * and classic scrollbars take the page's width. Other engines keep their own
 * scrolling.
 */
const windowsTest = test.extend({
  launchOptions: [
    async ({ browserName, launchOptions }, use) => {
      if (browserName !== "chromium") {
        await use(launchOptions);
        return;
      }
      await use({
        ...launchOptions,
        args: Arr.appendAll(launchOptions.args ?? [], [
          "--enable-smooth-scrolling",
          "--disable-features=OverlayScrollbar",
        ]),
        ignoreDefaultArgs: ["--hide-scrollbars"],
      });
    },
    { scope: "worker" },
  ],
});

/**
 * Records, in every frame the page draws, whether the outline marks more than one
 * entry, and keeps the first such frame: where the page stood and what it marked.
 */
const recordDoubleMarks = (page: Page) =>
  page.evaluate((links) => {
    const root = document.documentElement;
    root.dataset.outlineDoubled = "";
    const sample = () => {
      const marked = [...document.querySelectorAll(links)].filter(
        (link) => link.getAttribute("data-active") === "true"
      );
      if (marked.length > 1 && root.dataset.outlineDoubled === "") {
        root.dataset.outlineDoubled = `at ${root.scrollTop} px: ${marked
          .map((link) => link.getAttribute("href"))
          .join(" ")}`;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, OUTLINE_LINKS);

/** Waits until a wheel notch's smooth scroll has come to rest for five frames. */
const settle = (page: Page) =>
  Effect.promise(() =>
    page.waitForFunction(
      () =>
        new Promise<boolean>((resolve) => {
          let last = -1;
          let still = 0;
          const tick = () => {
            const top = document.documentElement.scrollTop;
            still = top === last ? still + 1 : 0;
            last = top;
            if (still >= 5) {
              resolve(true);
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        })
    )
  );

/** Turns the wheel one notch where the pointer rests, then waits for the page to rest. */
const turnWheel = (page: Page, delta: number) =>
  Effect.promise(() => page.mouse.wheel(0, delta)).pipe(
    Effect.andThen(settle(page))
  );

for (const scale of DISPLAY_SCALES) {
  windowsTest.describe(`at a display scale of ${scale * 100}%`, () => {
    windowsTest.use({ deviceScaleFactor: scale });

    /**
     * The owner reads on Windows: a fractional display scale, so scroll offsets and
     * heading edges fall between device pixels, and a mouse wheel that moves the
     * page about 100 px a notch in a smooth animation. Down to the end of the lesson
     * and back up, notch by notch, no frame marks two entries, such as a section and
     * its first subsection, and once each notch comes to rest the outline marks the
     * section being read. Above the first heading no section is read, and none is
     * marked.
     */
    windowsTest(
      "the outline marks one section at every wheel notch down and up a long lesson",
      async ({ baseURL, page }) => {
        windowsTest.slow();
        await Effect.runPromise(
          withObservedPageErrors(
            page,
            Effect.gen(function* () {
              const height = yield* openLesson(page, baseURL);
              expect(
                yield* Effect.promise(() =>
                  page.evaluate(() => window.devicePixelRatio)
                )
              ).toBe(scale);
              // The wheel turns over the header, which stays in place, so no
              // visual card under the pointer takes a notch for itself.
              yield* Effect.promise(() =>
                page.locator(PAGE_HEADER).first().hover()
              );
              yield* Effect.promise(() => recordDoubleMarks(page));
              const notches = Arr.makeBy(
                Math.ceil(height / WHEEL_NOTCH) + 2,
                (index) => index
              );

              yield* Effect.forEach(
                notches,
                () =>
                  turnWheel(page, WHEEL_NOTCH).pipe(
                    Effect.andThen(expectFollows(page))
                  ),
                { discard: true }
              );
              expect(
                (yield* Effect.promise(() => readOutline(page))).top
              ).toBeGreaterThanOrEqual(height - 1);

              yield* Effect.forEach(
                notches,
                () =>
                  turnWheel(page, -WHEEL_NOTCH).pipe(
                    Effect.andThen(expectFollows(page))
                  ),
                { discard: true }
              );
              expect((yield* Effect.promise(() => readOutline(page))).top).toBe(
                0
              );

              expect(
                yield* Effect.promise(() =>
                  page.evaluate(
                    () => document.documentElement.dataset.outlineDoubled
                  )
                )
              ).toBe("");
            })
          )
        );
      }
    );
  });
}
