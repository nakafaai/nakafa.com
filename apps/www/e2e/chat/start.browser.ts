import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { composerOf } from "../support/attachment";
import type { Changes } from "../support/changes";
import {
  LESSON_PATH,
  OPENED_CHAT,
  onThePage,
  openChatPage,
  runOnPage,
  START,
} from "../support/chat";
import { PROMPT, pageOpensChat, promptIn, write } from "../support/prompt";
import { BUBBLE } from "../support/selector";
import {
  inTheSheet,
  openSheet,
  UNAVAILABLE,
  UNCONFIRMED,
} from "../support/sheet";
import { mostCopies, watchCopies } from "../support/shown";
import { readinessTimeoutMilliseconds } from "../support/timeout";

/**
 * The prompt shows at once, Nina types after it and the composer is empty. Then
 * the chat opens, and in no frame from the press until then does a reader see
 * the prompt twice: the surface the prompt leaves and the chat it opens never
 * show it together.
 */
const showsAtOnce = (
  scope: Locator,
  changes: Changes,
  opensChat: () => Promise<void>
) =>
  Effect.promise(async () => {
    const page = scope.page();

    await write(scope);
    await watchCopies(page, BUBBLE, PROMPT);
    changes.hold();
    await composerOf(scope).press("Enter");
    await expect(promptIn(scope)).toBeVisible();
    await expect(scope.getByText("Loading", { exact: true })).toBeVisible();
    await expect(composerOf(scope)).toHaveValue("");
    changes.release();
    await opensChat();
    expect(await mostCopies(page)).toBe(1);
  });

/**
 * A prompt the server refuses shows at once, like any other. Once the page
 * learns of the refusal the prompt is gone, the words are back in the composer,
 * the learner is told, and nothing opened.
 */
const givesBackWhenRefused = (page: Page, scope: Locator, changes: Changes) =>
  Effect.promise(async () => {
    await write(scope);
    changes.hold();
    changes.failNext(START);
    await composerOf(scope).press("Enter");
    await expect(promptIn(scope)).toBeVisible();
    changes.release();
    await expect(page.getByText(UNCONFIRMED).first()).toBeVisible();
    await expect(promptIn(scope)).toHaveCount(0);
    await expect(composerOf(scope)).toHaveValue(PROMPT);
    await expect(page).not.toHaveURL(OPENED_CHAT);
  });

/** Waits until the sheet shows the chat its prompt opened, with the answer that failed. */
const sheetOpensChat = (page: Page) => async () => {
  await expect(promptIn(inTheSheet(page))).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(inTheSheet(page).getByText(UNAVAILABLE)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
};

for (const width of [390, 1440]) {
  test.describe(`New chat at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });
    test.describe.configure({ timeout: 180_000 });

    test("the page shows the prompt at once and opens the chat", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* showsAtOnce(onThePage(page), changes, pageOpensChat(page));
        })
      );
    });

    test("the page gives a refused prompt back", async ({ baseURL, page }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* givesBackWhenRefused(page, onThePage(page), changes);
        })
      );
    });

    test("the sheet shows the prompt at once and opens the chat", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* openSheet(page);
          yield* showsAtOnce(inTheSheet(page), changes, sheetOpensChat(page));
        })
      );
    });

    test("the sheet gives a refused prompt back", async ({ baseURL, page }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* openSheet(page);
          yield* givesBackWhenRefused(page, inTheSheet(page), changes);
        })
      );
    });
  });
}

/**
 * The learner closes the sheet while their first prompt is on its way, and the
 * server refuses it. The sheet's new chat stops waiting for the answer once it
 * is hidden, yet the words are not lost with it: they are in the composer when
 * the learner opens the sheet again.
 */
const givesBackAfterClosingTheSheet = Effect.fn(
  "NakafaE2E.givesBackAfterClosingTheSheet"
)(function* (page: Page, baseURL: string) {
  const { changes } = yield* openChatPage(page, baseURL);

  yield* openSheet(page);
  yield* Effect.promise(async () => {
    const sheet = inTheSheet(page);
    const hiddenComposer = composerOf(
      page.locator('[data-slot="sheet-popup"]')
    );

    await write(sheet);
    changes.hold();
    changes.failNext(START);
    await composerOf(sheet).press("Enter");
    await expect(promptIn(sheet)).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(hiddenComposer).toBeHidden();
    changes.release();
    await expect(page.getByText(UNCONFIRMED).first()).toBeVisible();
    // The toast covers the entry for a moment, and a press that lands on it
    // holds it there for as long as the pointer stays, so the press waits.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
      timeout: readinessTimeoutMilliseconds,
    });

    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();
    await expect(composerOf(inTheSheet(page))).toHaveValue(PROMPT);
  });
});

test.describe("New chat in a sheet closed before the server answers at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("the refused prompt is back in the composer when the sheet opens again", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      givesBackAfterClosingTheSheet(page, origin)
    );
  });
});
