import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A track whose table a learner reads live, and the set its first row opens. */
const TRACK_HREF = "/en/try-out/indonesia/snbt/2027";
const SET_HREF = `${TRACK_HREF}/set-1`;

/**
 * The page's client reaches a learner's table a moment after React takes the page
 * over, and the swap to the live table replaces every row. A browser sends no click
 * when the element it pressed leaves the document before the release, so the swap
 * waits for a held pointer. The socket opens once the client is there, so the
 * release comes after it.
 */
test("a press held while the page's client arrives opens the set", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(async () => {
          const socket = page.waitForEvent("websocket", {
            timeout: readinessTimeoutMilliseconds,
          });
          await page.goto(TRACK_HREF, { waitUntil: "domcontentloaded" });
          const link = page.locator(`main a[href='${SET_HREF}']`);
          await waitUntilTakenOver(link);
          await link.hover();
          await page.mouse.down();
          await socket;
          await page.mouse.up();
          await expect(page).toHaveURL(SET_HREF, {
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    )
  );
});
