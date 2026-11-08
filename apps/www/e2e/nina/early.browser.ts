import { expect, type Route, test } from "@playwright/test";
import { Effect, MutableList, MutableRef } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { NINA_SECTION } from "@/e2e/support/selector";
import { isTakenOver } from "@/e2e/support/window";

/** The page's scripts, which a test holds back so React has not run yet. */
const SCRIPTS = /\/assets\/.*\.js/u;
/** What the learner types before the page answers. */
const EARLY_TEXT = "A question typed before the page answers";

/**
 * A browser opens a file picker only within five seconds of the press that asked
 * for it, so the press made before React took the page over must reach the picker
 * within them: the page's scripts, its hydration, the Nina section's code and the
 * live composer all fit in that time. It runs in the timing suite, one test at a
 * time, because another test beside it on a loaded machine moves that time past
 * the browser's limit.
 */
test("a learner who types and presses attach before React takes the landing page over keeps the text and gets the file picker", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* seedAnalyticsConsent(page, "denied");
      yield* signInLearner(page.context(), origin);
      const held = MutableList.make<Route>();
      const released = MutableRef.make(false);
      yield* Effect.promise(() =>
        page.route(SCRIPTS, async (route) => {
          if (MutableRef.get(released)) {
            await route.continue();
            return;
          }
          MutableList.append(held, route);
        })
      );
      yield* Effect.promise(() => page.goto("/en"));
      const input = page
        .locator(NINA_SECTION)
        .getByRole("textbox", { name: "Ask Nina anything..." });
      const attach = input
        .locator("xpath=ancestor::form")
        .getByRole("button", { name: "Attach files" });

      const chooser = page.waitForEvent("filechooser");
      yield* Effect.promise(async () => {
        await input.fill(EARLY_TEXT);
        await attach.click();
        // React has not run, so the page keeps the press on the button.
        expect(await isTakenOver(attach)).toBe(false);
        await expect(attach).toHaveAttribute("data-pressed", "");
      });

      // The browser fetches the held scripts side by side, as it would have.
      MutableRef.set(released, true);
      yield* Effect.forEach(
        MutableList.toArray(held),
        (route) => Effect.promise(() => route.continue()),
        { concurrency: "unbounded", discard: true }
      );
      yield* Effect.promise(() => chooser);
      yield* Effect.promise(() => expect(input).toHaveValue(EARLY_TEXT));
    })
  );
});
