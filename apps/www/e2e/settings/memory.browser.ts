import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const MEMORY_PATH = "/en/user/settings/memory";
const MEMORY_TITLE = /Memory/;
const EMPTY = "Nina has not remembered anything yet.";
const WRITTEN = "Prefers worked examples before the formula";
const REWRITTEN = "Prefers a short summary before the examples";
const DISCARDED = "This text is never saved";
/** How long a step waits for the server to answer a change. */
const ANSWER_MILLISECONDS = 15_000;

/** One memory on the page, found by its words. */
const memoryRow = (page: Page, text: string) =>
  page.locator("main").getByRole("listitem").filter({ hasText: text });

/** The editor of a memory. Its code loads when the learner opens it. */
const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Memory text" });

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

/** Repeats a reload until the server shows what the learner changed. */
const reloadUntil = (page: Page, check: () => Promise<void>) =>
  expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 20_000 });

const addMemory = Effect.fn("NakafaE2E.addMemory")(function* (page: Page) {
  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();

    const editor = editorOf(page);
    const save = page.getByRole("button", { exact: true, name: "Save" });
    await expect(editor).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(save).toBeDisabled();
    await editor.fill(WRITTEN);
    await expect(page.getByText(`${WRITTEN.length} / 280`)).toBeVisible();
    await save.click();

    const row = memoryRow(page, WRITTEN);
    await expect(row).toBeVisible();
    await expect(row.getByText("Written by you")).toBeVisible();
    await expect(row.getByText("In use")).toBeVisible();
    await expect(page.getByText(EMPTY)).toBeHidden();
  });
});

const editMemory = Effect.fn("NakafaE2E.editMemory")(function* (page: Page) {
  yield* Effect.promise(async () => {
    const row = memoryRow(page, WRITTEN);
    const editor = editorOf(page);

    // Escape leaves the memory as it was.
    await row.getByRole("button", { name: "Edit memory" }).click();
    await expect(editor).toHaveText(WRITTEN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await editor.fill(DISCARDED);
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(memoryRow(page, DISCARDED)).toHaveCount(0);

    // Enter keeps the new words and the new kind.
    await row.getByRole("button", { name: "Edit memory" }).click();
    await expect(editor).toHaveText(WRITTEN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "Goal" }).click();
    await editor.fill(REWRITTEN);
    await editor.press("Enter");

    const rewritten = memoryRow(page, REWRITTEN);
    await expect(rewritten).toBeVisible();
    await expect(rewritten.getByText("Goal")).toBeVisible();
    await expect(memoryRow(page, WRITTEN)).toHaveCount(0);
  });
});

const pauseMemory = Effect.fn("NakafaE2E.pauseMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const pause = page.getByRole("switch", { name: "Pause memory" });
    const row = memoryRow(page, REWRITTEN);

    await expect(pause).not.toBeChecked();
    await expect(row.getByText("In use")).toBeVisible();
    const before = changes.sent;
    await pause.click();
    await expect(pause).toBeChecked();
    // A paused Nina reads nothing, and every memory stays.
    await expect(row.getByText("In use")).toBeHidden();
    await expect(row).toBeVisible();

    await saved(changes, before);
    await reloadUntil(page, () => expect(pause).toBeChecked({ timeout: 3000 }));
    await expect(row).toBeVisible();
    await pause.click();
    await expect(pause).not.toBeChecked();
    await expect(row.getByText("In use")).toBeVisible();
  });
});

const removeMemory = Effect.fn("NakafaE2E.removeMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    const row = memoryRow(page, REWRITTEN);
    const remove = row.getByRole("button", { name: "Delete memory" });

    // Undo writes the words back as the learner's own memory.
    await remove.click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(row).toBeVisible();
    await expect(row.getByText("Written by you")).toBeVisible();

    // The server deletes the memory at once: it is gone after a reload made
    // while the toast still offers the Undo.
    const before = changes.sent;
    await remove.click();
    await expect(row).toHaveCount(0);
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(page.getByText(EMPTY)).toBeVisible({ timeout: 3000 })
    );
  });
});

/**
 * Signs a synthetic learner in and walks the Memory page: it adds a memory,
 * edits its words and kind, pauses and resumes memory, and deletes the memory
 * once with Undo and once for real.
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

  yield* addMemory(page);
  yield* editMemory(page);
  yield* pauseMemory(page, changes);
  yield* removeMemory(page, changes);
});

for (const width of [390, 1440]) {
  test.describe(`Memory page at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("adds, edits, pauses and deletes a memory", async ({
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
