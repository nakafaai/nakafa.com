import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOverNow, waitUntilTakenOver } from "@/e2e/support/window";

/** A track whose table a learner reads live, and the set its first row opens beside it. */
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
for (const round of [1, 2, 3, 4, 5, 6, 7, 8]) test(`a press on a row while the page's client arrives opens the set beside the table ${round}`, async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(async () => {
          const link = page.locator(`main a[href='${SET_HREF}']`);
          const started = Date.now();
          await page.addInitScript(() => {
            window.addEventListener("vite:preloadError", (event) => {
              const payload = (event as unknown as { payload: unknown }).payload;
              const resources = performance
                .getEntriesByType("resource")
                .filter((entry) => entry.name.endsWith(".js"))
                .map((entry) => {
                  const timing = entry as PerformanceResourceTiming;
                  return `${timing.name.split("/").pop()}:${timing.initiatorType}:${Math.round(timing.startTime)}+${Math.round(timing.duration)}:${timing.transferSize}:${timing.responseStatus}`;
                });
              const links = Array.from(document.querySelectorAll("link[rel=modulepreload]")).map((link) => `${(link as HTMLLinkElement).href.split("/").pop()}|${link.getAttribute("crossorigin")}`);
              console.log(`preloadError t=${Math.round(performance.now())} ${String(payload)} STACK ${payload instanceof Error ? payload.stack : ""} RES ${resources.join(" ")} LINKS ${links.join(" ")}`);
            });
          });
          page.on("console", (message) => {
            if (message.text().startsWith("preloadError")) console.log(`PROBE ${Date.now() - started} ${message.text().slice(0, 12000)}`);
          });
          page.on("requestfailed", (request) => console.log(`PROBE failed ${Date.now() - started} ${request.url()} ${request.failure()?.errorText}`));
          page.on("response", (response) => {
            if (response.url().includes("/assets/") && response.status() !== 200) console.log(`PROBE status ${Date.now() - started} ${response.status()} ${response.url()}`);
          });
          page.on("request", (request) => {
            if (request.isNavigationRequest() && request.frame() === page.mainFrame()) console.log(`PROBE nav ${Date.now() - started} ${request.url()}`);
          });
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
          // The set opens in the pane beside the table, at the set's own address.
          await expect(
            page.getByRole("heading", { exact: true, name: "Set 1" })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          expect(new URL(page.url()).pathname).toBe(SET_HREF);
        });
      })
    )
  );
});
