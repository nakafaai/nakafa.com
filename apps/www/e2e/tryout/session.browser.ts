import { expect, type Page, test } from "@playwright/test";
import { Effect, MutableRef } from "effect";
import { type Changes, saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import {
  entrySetHref,
  finishEntryAttempt,
  startEntryAttempt,
} from "@/e2e/support/entry";
import { activate } from "@/e2e/support/input";
import { questionArticle } from "@/e2e/support/player";

/** The route the page reads its Convex token from. */
const TOKEN_ROUTE = "**/api/auth/convex/token**";

/**
 * Has Convex refuse the page's session while its next token read is refused
 * too, so the page's session reads as loading and every authenticated read
 * pauses. `check` runs meanwhile. Then the token route answers again and the
 * reader comes back to the page, which signs in again.
 */
const whileSessionReloads = Effect.fn("NakafaE2E.whileTryoutSessionReloads")(
  function* (page: Page, changes: Changes, check: Effect.Effect<void>) {
    const refused = MutableRef.make(0);
    yield* Effect.promise(() =>
      page.route(TOKEN_ROUTE, (route) => {
        MutableRef.update(refused, (count) => count + 1);
        return route.fulfill({ body: "", status: 403 });
      })
    );
    yield* Effect.sync(() => changes.expireSession());
    yield* Effect.promise(() =>
      expect.poll(() => MutableRef.get(refused)).toBeGreaterThan(0)
    );
    // The refusal reaches the session store once the token read has answered.
    yield* Effect.sleep("1 second");
    yield* check;
    yield* Effect.promise(() => page.unroute(TOKEN_ROUTE));
    yield* Effect.promise(() =>
      page.evaluate(() => window.dispatchEvent(new Event("online")))
    );
  }
);

/** Picks the first option of one question and waits until the server holds it. */
const answer = Effect.fn("NakafaE2E.answerTryoutQuestion")(function* (
  page: Page,
  changes: Changes,
  number: number
) {
  const option = questionArticle(page, number).getByRole("radio").first();
  const sentBefore = changes.sent;
  yield* activate(option, false);
  yield* Effect.promise(async () => {
    await expect(option).toBeChecked();
    await saved(changes, sentBefore);
  });
});

test.describe("A try-out while Convex confirms the session again", () => {
  // Two attempts run and finish the set before the history shows.
  test.describe.configure({ timeout: 240_000 });

  test("keeps the running attempt and the finished set's history on screen", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        yield* Effect.promise(() =>
          page.goto(entrySetHref, { waitUntil: "commit" })
        );

        // The running attempt keeps its player and the learner's answer, and
        // takes the next answer once the session holds again.
        yield* startEntryAttempt(page, "Start", "Start free");
        yield* answer(page, changes, 1);
        yield* whileSessionReloads(
          page,
          changes,
          Effect.promise(async () => {
            await expect(
              page.getByRole("button", { exact: true, name: "Finish" })
            ).toBeVisible();
            await expect(
              questionArticle(page, 1).getByRole("radio").first()
            ).toBeChecked();
          })
        );
        yield* answer(page, changes, 2);
        yield* finishEntryAttempt(page);

        // A second attempt gives the set a history, and its picker stays.
        yield* startEntryAttempt(page, "Restart", "Start free");
        yield* finishEntryAttempt(page);
        const picker = page
          .locator("main")
          .getByRole("button", { exact: true, name: "Attempt 2" });
        yield* Effect.promise(() => expect(picker).toBeVisible());
        yield* whileSessionReloads(
          page,
          changes,
          Effect.promise(() => expect(picker).toBeVisible())
        );
      })
    );
  });
});
