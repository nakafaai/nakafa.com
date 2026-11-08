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

/**
 * Scrolls the page to `top`, then reads the section being read and the entry
 * the outline marks. The section being read is the last heading, in outline
 * order, whose top has passed the line where a jump to it stops (its scroll
 * margin, and never above the page header), or the last heading on screen when
 * the page cannot scroll further. The marked entry must also stand inside the
 * outline's own scroller.
 */
const readAt = (page: Page, top: number) =>
  page.evaluate(
    ({ links, to }) => {
      window.scrollTo({ behavior: "instant", top: to });
      const anchors = [...document.querySelectorAll(links)].filter(
        (link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement
      );
      const header =
        document
          .querySelector('[data-slot="page-header"]')
          ?.getBoundingClientRect().bottom ?? 0;
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
            header,
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
      };
    },
    { links: OUTLINE_LINKS, to: top }
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
  const href = pinnedRoutes.growth.en;
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto(`${baseURL ?? ""}${href}`, {
            waitUntil: "domcontentloaded",
          })
        );
        yield* waitForCommittedAppRouter(
          page,
          href,
          href,
          readinessTimeoutMilliseconds
        );
        yield* Effect.promise(() =>
          expect(page.locator(OUTLINE_LINKS).first()).toBeVisible()
        );
        const { height, step } = yield* Effect.promise(() =>
          page.evaluate(() => ({
            height: document.documentElement.scrollHeight - window.innerHeight,
            step: Math.round(window.innerHeight / 3),
          }))
        );
        const down = Arr.makeBy(
          Math.ceil(height / step) + 1,
          (index) => index * step
        );

        yield* Effect.forEach(
          Arr.appendAll(down, Arr.reverse(down)),
          (top) =>
            Effect.promise(() =>
              expect
                .poll(
                  async () => {
                    const read = await readAt(page, top);
                    const marked = Arr.join(read.marked, " ");
                    const reading = Arr.join(read.reading, " ");
                    return read.shown && marked === reading
                      ? "follows"
                      : `at ${top} px the outline marks "${marked}" while "${reading}" is read, in sight ${read.shown}`;
                  },
                  { timeout: 3000 }
                )
                .toBe("follows")
            ),
          { discard: true }
        );

        expect(yield* Effect.promise(() => unmatchedLinks(page))).toEqual([]);
      })
    )
  );
});
