import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { setHref, trackHref } from "@/e2e/support/tryout";

/** What Cloudflare's assets answer a page with, which a Worker render never sends. */
const ASSET_CACHE = "public, max-age=0, must-revalidate";
const HINT_COOKIE = "nakafa-signed-in";
const SESSION_ANSWER = "**/api/auth/get-session**";
/** A progress mark of the rows every visitor reads. */
const SHARED_MARK = '[data-rows="shared"] [data-progress]';

/**
 * A learner's try-out page is the page the build wrote, at its own address, so no
 * Worker renders it: the attempt is read in the browser, and the first HTML held
 * nothing of the learner's before either.
 */
for (const href of [trackHref, setHref]) {
  test(`${href} answers a signed-in learner from the static assets`, async ({
    baseURL,
    context,
    page,
  }) => {
    await Effect.runPromise(signInLearner(context, baseURL ?? ""));
    const response = await page.goto(href);
    const headers = response?.headers() ?? {};
    expect(headers["cache-control"]).toBe(ASSET_CACHE);
    expect(headers["set-cookie"]).toBeUndefined();
  });
}

/**
 * The track's first rows hold no one's progress, so a signed-in hint hides their
 * marks from the first paint, in their own room, instead of telling a learner that
 * a finished set is not started. The session never answers here, so the rows stay
 * the shared ones, and a visitor without the hint sees the marks.
 */
test("a signed-in hint hides the progress marks of the shared rows", async ({
  baseURL,
  context,
  page,
}) => {
  await page.goto(trackHref);
  await expect(page.locator(SHARED_MARK).first()).toBeVisible();

  await context.addCookies([
    { name: HINT_COOKIE, url: baseURL ?? "", value: "1" },
  ]);
  await page.route(SESSION_ANSWER, () => undefined);
  await page.goto(trackHref);
  await expect(page.locator(SHARED_MARK).first()).toBeHidden();
});
