import { instant } from "@next/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { Effect } from "effect";
import { loadMathFonts } from "@/e2e/support/fonts";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { settlePrefetch } from "@/e2e/support/navigation/settle";
import {
  expectStillShell,
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Loads `href` with the frame recorder running and its router hydrated. */
export const openObservedRoute = Effect.fn("NakafaE2E.openObservedRoute")(
  function* (page: Page, href: string) {
    yield* observeShell(page);
    yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
  }
);

/** Reads the path a link opens. */
export const readPathname = Effect.fn("NakafaE2E.readLinkPathname")(function* (
  link: Locator
) {
  const href = yield* Effect.promise(() => link.getAttribute("href")).pipe(
    Effect.flatMap(Effect.fromNullishOr)
  );
  return new URL(href, "https://nakafa.com").pathname;
});

/** The first paragraph of the page's article. */
const articleText = (page: Page) =>
  page.getByRole("article").locator("p").first();

/**
 * Opens `link` while Next.js holds back everything a prefetch did not load, so
 * the destination's heading and its text have to come from the link's own
 * prefetch. The reader's sign of intent comes first and its prefetch and
 * scripts land before the press, as they would for a reader who pauses on the
 * link: a touch press starts with a touch, otherwise the link is focused, the
 * keyboard's sign of intent, and opened with Enter. Every frame from the press
 * on must show the one app shell and a page heading: first the current page's,
 * then the destination's, with no empty frame and no layout shift between
 * them.
 */
export const openPrefetched = Effect.fn("NakafaE2E.openPrefetched")(function* (
  page: Page,
  link: Locator,
  hasTouch: boolean
) {
  const pathname = yield* readPathname(link);
  const heading = page.getByRole("heading", { level: 1 });
  const source = yield* Effect.promise(() => heading.innerText());
  yield* settlePrefetch(
    page,
    pathname,
    Effect.promise(() =>
      link
        .scrollIntoViewIfNeeded()
        .then(() =>
          hasTouch ? link.dispatchEvent("touchstart") : link.focus()
        )
    )
  );
  yield* loadMathFonts(page);
  const since = yield* readPageTime(page);
  // @next/playwright owns this native Promise callback while its lock is held.
  yield* Effect.promise(() =>
    instant(page, () =>
      (hasTouch
        ? link.tap({ noWaitAfter: true })
        : link.press("Enter", { noWaitAfter: true })
      )
        .then(() =>
          page.waitForURL((url) => url.pathname === pathname, {
            timeout: readinessTimeoutMilliseconds,
          })
        )
        .then(() =>
          expect(heading).toHaveCount(1, {
            timeout: readinessTimeoutMilliseconds,
          })
        )
        .then(() => expect(heading).not.toHaveText(source))
        .then(() =>
          expect(articleText(page)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        )
    )
  );
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(observation, [false]));
});
