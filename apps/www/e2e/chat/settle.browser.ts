import { expect, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { composerOf } from "@/e2e/support/attachment";
import { LESSON_PATH, openChatPage, runOnPage } from "@/e2e/support/chat";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PROMPT = "What is the slope of a line?";
const TITLE = "The slope of a line";
/** The session route, which the test answers late after the reload. */
const SESSION_READ = "**/api/auth/get-session**";
/** How long the session read waits before it answers. */
const SESSION_DELAY = Duration.seconds(4);
/** How soon the open chat's composer must show once the sheet opens, well inside the delay. */
const SHOWN_WITHIN = 2500;

/**
 * A learner's sheet keeps the chat it had open while the page's session
 * confirms: after a reload whose session answers late, the reopened sheet shows
 * the chat's composer at once, never an empty body that fills in later.
 */
test("keeps the open chat in the sheet while the session confirms", async ({
  baseURL,
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ height: 900, width: 1440 });
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      yield* learner.startChat(PROMPT);
      yield* learner.titleNewest([TITLE]);
      yield* openSheet(page);
      yield* openFromHistory(page, TITLE);
      yield* Effect.promise(async () => {
        await expect(promptWith(inTheSheet(page), PROMPT)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await page.route(SESSION_READ, async (route) => {
          await Effect.runPromise(Effect.sleep(SESSION_DELAY));
          await route.continue();
        });
        await page.goto(LESSON_PATH, { waitUntil: "load" });
        await page
          .getByRole("button", { exact: true, name: "Ask Nina" })
          .click();
        await expect(composerOf(inTheSheet(page))).toBeVisible({
          timeout: SHOWN_WITHIN,
        });
      });
    })
  );
});
