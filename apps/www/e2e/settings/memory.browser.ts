import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const MEMORY_PATH = "/en/user/settings/memory";
const MEMORY_TITLE = /Memory/;
const EMPTY = "No memories yet";
const WRITTEN = "Prefers worked examples before the formula";
const REWRITTEN = "Prefers a short summary before the examples";
const NAMED = "Study habits";
/** How long a step waits for the server to answer a change. */
const ANSWER_MILLISECONDS = 15_000;

/** One memory on the page, found by its title or its words. */
const memoryRow = (page: Page, text: string) =>
  page.locator("main").getByRole("listitem").filter({ hasText: text });

/** The text of a memory in its editor. The editor's code loads when the learner opens it. */
const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Memory text" });

/** The title of a memory in its editor. */
const titleOf = (page: Page) =>
  page.getByRole("textbox", { exact: true, name: "Title" });

/**
 * Counts the changes the page sent and the ones the server answered. The page
 * shows a change before the server has it, and a reload closes the connection
 * and drops a change that is still on its way, so a step that reloads waits
 * for the answer first.
 */
const trackChanges = (page: Page) => {
  const changes = { answered: 0, sent: 0 };
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      if (String(payload).includes('"type":"Mutation"')) {
        changes.sent += 1;
      }
    });
    socket.on("framereceived", ({ payload }) => {
      if (String(payload).includes('"type":"MutationResponse"')) {
        changes.answered += 1;
      }
    });
  });
  return changes;
};

type Changes = ReturnType<typeof trackChanges>;

/** Waits until the page sent a change after `sentBefore` and the server answered every change. */
const saved = (changes: Changes, sentBefore: number) =>
  expect
    .poll(
      () => changes.sent > sentBefore && changes.answered === changes.sent,
      { timeout: ANSWER_MILLISECONDS }
    )
    .toBe(true);

/**
 * Presses a switch until it shows `checked`. Right after a reload the page
 * shows the switch before its code runs, and a press in that moment is lost.
 */
const switchUntil = (control: Locator, checked: boolean) =>
  expect(async () => {
    if ((await control.isChecked()) !== checked) {
      await control.click();
    }
    await expect(control).toBeChecked({ checked, timeout: 1000 });
  }).toPass({ timeout: ANSWER_MILLISECONDS });

/** Repeats a reload until the server shows what the learner changed. */
const reloadUntil = (page: Page, check: () => Promise<void>) =>
  expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 20_000 });

const addMemory = Effect.fn("NakafaE2E.addMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();

    const editor = editorOf(page);
    const row = memoryRow(page, WRITTEN);
    await expect(editor).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("0 / 2,000")).toBeVisible();

    // The editor has no Save: the words are stored a moment after the last key.
    const before = changes.sent;
    await editor.fill(WRITTEN);
    await expect(page.getByText(`${WRITTEN.length} / 2,000`)).toBeVisible();
    await saved(changes, before);

    // The editor stays on the memory it just stored, and Escape closes it.
    await expect(editor).toHaveText(WRITTEN);
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(row.getByText("Written by you")).toBeVisible();
    await expect(page.getByText(EMPTY)).toBeHidden();
    await reloadUntil(page, () => expect(row).toBeVisible({ timeout: 3000 }));
  });
});

const editMemory = Effect.fn("NakafaE2E.editMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const editor = editorOf(page);
    const title = titleOf(page);
    const row = memoryRow(page, NAMED);

    // A press on the memory opens it. A title written in place is stored like
    // the words, and Enter moves on to the text.
    await memoryRow(page, WRITTEN).getByText(WRITTEN).click();
    await expect(editor).toHaveText(WRITTEN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(title).toHaveValue("");
    const named = changes.sent;
    await title.fill(NAMED);
    await saved(changes, named);
    await title.press("Enter");
    await expect(editor).toBeFocused();

    // Closing the editor right after the last key still stores the words.
    const before = changes.sent;
    await editor.fill(REWRITTEN);
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(editor).toHaveCount(0);
    await saved(changes, before);
    // The list now calls the memory by its title.
    await expect(row).toBeVisible();
    await reloadUntil(page, () => expect(row).toBeVisible({ timeout: 3000 }));

    // The row's own action opens it too, with the title and the words it kept.
    await row.hover();
    await row.getByRole("button", { name: "Edit memory" }).click();
    await expect(editor).toHaveText(REWRITTEN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(title).toHaveValue(NAMED);
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
  });
});

const pauseMemory = Effect.fn("NakafaE2E.pauseMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const remember = page.getByRole("switch", {
      name: "Let Nina save and use memories",
    });
    const row = memoryRow(page, NAMED);

    await expect(remember).toBeChecked();
    const before = changes.sent;
    await remember.click();
    await expect(remember).not.toBeChecked();
    // Turning memory off keeps every memory.
    await expect(row).toBeVisible();

    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(remember).not.toBeChecked({ timeout: 3000 })
    );
    await expect(row).toBeVisible();
    await switchUntil(remember, true);
  });
});

const removeMemory = Effect.fn("NakafaE2E.removeMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const row = memoryRow(page, NAMED);
    const editor = editorOf(page);

    // The editor deletes the memory it shows, and Undo writes its title and
    // its words back as the learner's own memory.
    await row.getByText(NAMED).click();
    await expect(editor).toHaveText(REWRITTEN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { exact: true, name: "Delete" }).click();
    await expect(editor).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(row).toBeVisible();
    await expect(row.getByText("Written by you")).toBeVisible();

    // The server deletes the memory at once: it is gone after a reload made
    // while the toast still offers the Undo.
    const before = changes.sent;
    await row.hover();
    await row.getByRole("button", { name: "Delete memory" }).click();
    await expect(row).toHaveCount(0);
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
    );
  });
});

/**
 * Signs a synthetic learner in and walks the Memory page: it writes a memory
 * in the editor, which saves by itself, gives it a title and new words, turns
 * memory off and on, and deletes the memory once with Undo and once for real.
 */
const verifyMemoryPage = Effect.fn("NakafaE2E.verifyMemoryPage")(function* (
  page: Page,
  baseURL: string
) {
  const changes = trackChanges(page);
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(() => page.goto(MEMORY_PATH));
  yield* Effect.promise(() => expect(page).toHaveTitle(MEMORY_TITLE));

  // A signed-in learner decides analytics once for the account.
  const decline = page.getByRole("button", { exact: true, name: "Decline" });
  yield* activate(decline, false);
  yield* Effect.promise(() =>
    expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );

  yield* addMemory(page, changes);
  yield* editMemory(page, changes);
  yield* pauseMemory(page, changes);
  yield* removeMemory(page, changes);
});

for (const width of [390, 1440]) {
  test.describe(`Memory page at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("writes, names, turns off and deletes a memory", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) => verifyMemoryPage(page, origin))
          )
        )
      );
    });
  });
}
