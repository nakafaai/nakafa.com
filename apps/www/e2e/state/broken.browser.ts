import { expect, type Page, test } from "@playwright/test";
import { wholeHeight } from "@repo/design-system/components/nina/height";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { NINA_SIZE } from "@/components/state/size";
import { activateUntilVisible } from "../support/input";
import { expectNoOverflow } from "../support/layout";
import { waitForCommittedAppRouter } from "../support/navigation/readiness";
import { withObservedPageErrors } from "../support/observe";
import { APP_CHUNK_PATH, openRoute } from "../support/route";
import { STATE_FIGURE } from "../support/selector";
import { readinessTimeoutMilliseconds } from "../support/timeout";
import {
  compactViewport,
  desktopViewport,
  touchViewport,
} from "../support/viewport";

/** What a visitor must never read on this page: the error itself. */
const ERROR_DETAILS = /ChunkLoadError|digest|5XX|\bat \w+ \(/i;

/**
 * The routes that break the same way, each with the control whose first press
 * fails: the theme button on both. Its list loads on that first press, because
 * it carries one icon for each theme, which no page needs before a visitor
 * reaches for the selector. With every chunk aborted the press throws inside
 * the page, and the nearest error boundary takes over: the one of the app for
 * a page of the app, whose button is in the footer, and the one of the entry
 * pages for the sign-in page, whose button is in its header.
 */
const ROUTES = [
  {
    control: (page: Page) =>
      page
        .locator("footer")
        .getByRole("button", { exact: true, name: app.Common.theme }),
    href: "/en",
    name: "a page of the app",
  },
  {
    control: (page: Page) =>
      page
        .getByRole("main")
        .getByRole("button", { exact: true, name: app.Common.theme }),
    href: "/en/auth",
    name: "the sign-in page",
  },
] as const;

/**
 * Makes a route fail the way a visitor meets it, then shows its words and two
 * ways on. Nina's own chunk is aborted too, so this also proves that the page
 * stands without her, and that her place keeps the height she will fill: a
 * figure that arrives late moves nothing. Trying again brings the page back
 * once the chunks can load.
 */
const verifyBrokenState = Effect.fn("NakafaE2E.verifyBrokenState")(function* (
  page: Page,
  target: (typeof ROUTES)[number]
) {
  yield* openRoute(page, target.href, "denied");
  yield* waitForCommittedAppRouter(
    page,
    target.href,
    target.href,
    readinessTimeoutMilliseconds
  );

  const selector = target.control(page);
  const heading = page.getByRole("heading", {
    level: 1,
    name: en.Error.title,
  });
  yield* Effect.promise(() =>
    page.route(APP_CHUNK_PATH, (route) => route.abort("failed"))
  );
  yield* activateUntilVisible(selector, heading, readinessTimeoutMilliseconds);

  const state = page.getByRole("main");
  yield* Effect.promise(() =>
    expect(state).toContainText(en.Error.description)
  );
  yield* Effect.promise(() => expect(state).not.toContainText(ERROR_DETAILS));
  yield* Effect.promise(() =>
    expect(
      page.getByRole("link", { name: en.State["home-button"] })
    ).toHaveAttribute("href", "/en")
  );
  yield* expectNoOverflow(page);

  const place = state.locator(STATE_FIGURE);
  yield* Effect.promise(() => expect(place.locator("svg")).toHaveCount(0));
  yield* Effect.promise(() =>
    expect(place).toHaveCSS("height", `${wholeHeight(NINA_SIZE)}px`)
  );

  const retry = page.getByRole("button", { name: en.Error.retry });
  yield* Effect.promise(() => expect(retry).toBeVisible());
  yield* Effect.promise(() => page.unroute(APP_CHUNK_PATH));
  yield* Effect.promise(() => retry.click());
  yield* Effect.promise(() => expect(heading).toBeHidden());
  yield* Effect.promise(() => expect(selector).toBeVisible());
});

for (const viewport of [desktopViewport, touchViewport, compactViewport]) {
  for (const target of ROUTES) {
    test.describe(`the state of something that broke on ${target.name} at ${viewport.name}`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        viewport: { height: viewport.height, width: viewport.width },
      });

      test("an error shows the broken state, and trying again brings the page back", async ({
        page,
      }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyBrokenState(page, target))
        );
      });
    });
  }
}
