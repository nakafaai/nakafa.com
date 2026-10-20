import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  ANSWER_MILLISECONDS,
  saved,
  trackChanges,
} from "../support/changes";
import { runOnPage } from "../support/chat";
import { seedAnalyticsConsent } from "../support/consent";
import { signInLearner } from "../support/learner";
import { LIST_QUERY, MEMORY_PATH } from "../support/memory";
import { isTakenOver } from "../support/window";

/** The Convex name of `nina.memory.pause`, the mutation behind the switch. */
const PAUSE_MUTATION = "nina/memory:pause";
/** The switch that lets Nina save and use memories. */
const REMEMBER = "Let Nina save and use memories";
/** The title of the Memory page. */
const MEMORY_TITLE = /Memory/;

/**
 * The switch moves on the press, before the server answers, though the page has
 * not read whether memory is paused yet: the answers are held from the first
 * load. A refused change returns the switch once the server refuses it.
 */
const pausesBeforeTheAnswer = Effect.fn("NakafaE2E.memoryPausesBeforeAnswer")(
  function* (page: Page, baseURL: string, refused: boolean) {
    const changes = yield* trackChanges(page, [LIST_QUERY]);
    yield* seedAnalyticsConsent(page, "denied");
    yield* signInLearner(page.context(), baseURL);
    changes.hold();
    if (refused) {
      changes.failNext(PAUSE_MUTATION);
    }

    yield* Effect.promise(async () => {
      await page.goto(MEMORY_PATH);
      await expect(page).toHaveTitle(MEMORY_TITLE);
      const remember = page.getByRole("switch", { name: REMEMBER });
      const before = changes.sent;

      await expect(remember).toBeChecked();
      // A press before the page signs in is refused by the server, so the test
      // waits for the sign-in first. React can drop a press on a switch that it
      // has not taken over yet, so the test waits for that too and presses once.
      await expect
        .poll(() => changes.signedIn, { timeout: ANSWER_MILLISECONDS })
        .toBe(true);
      await expect
        .poll(() => isTakenOver(remember), { timeout: ANSWER_MILLISECONDS })
        .toBe(true);
      await remember.click();
      await expect(remember).not.toBeChecked();

      changes.release();
      await saved(changes, before);
      if (refused) {
        await expect(remember).toBeChecked();
      } else {
        await expect(remember).not.toBeChecked();
      }
    });
  }
);

test.describe("Memory switch at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("moves the switch before the server answers, though the page has not read the state", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      pausesBeforeTheAnswer(page, origin, false)
    );
  });

  test("returns the switch when the server refuses the change", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      pausesBeforeTheAnswer(page, origin, true)
    );
  });
});
