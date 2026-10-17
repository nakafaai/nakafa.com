import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { composerOf } from "@/e2e/support/attachment";
import type { Changes } from "@/e2e/support/changes";
import {
  OPENED_CHAT,
  onThePage,
  openChatPage,
  runOnPage,
} from "@/e2e/support/chat";
import { LEARNER_TEXT, PASTED } from "@/e2e/support/prose";
import { MARKDOWN_MARKUP, NINA_SHOWCASE } from "@/e2e/support/selector";
import { promptWith } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** What a learner writes first: lines that Markdown would read as markup, then a pasted set of exercises. */
const WORDS = `${LEARNER_TEXT.angle}\n${LEARNER_TEXT.product}\n${LEARNER_TEXT.choices}\n${PASTED}`;

/**
 * What a surface shows while the first message of a learner is on its way:
 * every word as they wrote it, and a message as long as a pasted page folded.
 * A surface that read the words as Markdown, or showed them whole, fails here.
 */
const showsWordsAsWritten = (page: Page, scope: Locator, changes: Changes) =>
  Effect.promise(async () => {
    await composerOf(scope).fill(WORDS);
    await expect(
      scope.getByRole("button", { name: "Send message" })
    ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    changes.hold();
    await composerOf(scope).press("Enter");

    const bubble = promptWith(scope, LEARNER_TEXT.angle);
    // The box that holds the words, which keeps every word of a folded message.
    const words = bubble.locator("[id]");

    await expect(bubble).toBeVisible();
    await expect
      .poll(() => words.evaluate((box) => box.textContent))
      .toBe(WORDS);
    await expect(bubble.locator(MARKDOWN_MARKUP)).toHaveCount(0);
    await expect(
      bubble.getByRole("button", { name: "Show more" })
    ).toBeVisible();

    changes.release();
    await expect(page).toHaveURL(OPENED_CHAT, {
      timeout: readinessTimeoutMilliseconds,
    });
  });

test.describe("A learner's first message at 390px", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows its words as written on the new chat page", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);

        yield* showsWordsAsWritten(page, onThePage(page), changes);
      })
    );
  });

  test("shows its words as written under the composer of the homepage", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);

        yield* Effect.promise(() => page.goto("/en"));
        yield* showsWordsAsWritten(page, page.locator(NINA_SHOWCASE), changes);
      })
    );
  });
});
