import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOverNow, waitUntilTakenOver } from "@/e2e/support/window";

/** A track whose table a learner reads live, and the set its first row opens. */
const TRACK_HREF = "/en/try-out/indonesia/snbt/2027/utbk";
const SET_HREF = `${TRACK_HREF}/set-1`;

/**
 * A learner's table swaps to its live variant once it hydrates with the page's
 * client there, which replaces every row, and a browser sends no click when the
 * element it pressed leaves the document before the release. So the swap waits for
 * the release. The pointer rests on the row before the page loads, so no move
 * hydrates the table early. The press lands once React holds the page's shell, which
 * comes before the client, and the release once the socket says the client is there.
 */
test("a press on a row while the page's client arrives opens the set", async ({
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
          const link = page.locator(`main a[href='${SET_HREF}']`);
          await page.goto(TRACK_HREF);
          await link.hover();
          const socket = page.waitForEvent("websocket", {
            timeout: readinessTimeoutMilliseconds,
          });
          await page.goto(TRACK_HREF, { waitUntil: "domcontentloaded" });
          await expect
            .poll(() => isTakenOverNow(page.locator("main")), {
              intervals: [10],
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(true);
          await page.mouse.down();
          await socket;
          await waitUntilTakenOver(link);
          await page.mouse.up();
          await expect(page).toHaveURL(SET_HREF, {
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    )
  );
});
