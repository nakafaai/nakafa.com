import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  EMPTY,
  editorOf,
  memoryRow,
  opened,
  openMemoryPage,
  reloadUntil,
  saved,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const WRITTEN = "Prefers worked examples before the formula";
const REWRITTEN = "Prefers a short summary before the examples";
const NAMED = "Study habits";
const LINKED = "https://nakafa.com/en";
/** From this width on, the button that adds a memory shows its word. */
const LABEL_WIDTH = 640;

/** The title of a memory in its editor. */
const titleOf = (page: Page) =>
  page.getByRole("textbox", { exact: true, name: "Title" });

/**
 * Presses a switch after a reload until it shows `checked`. It waits for the
 * page's connection to sign in first, because a change pressed before that is
 * refused. The page also shows the switch before its code runs, and a press in
 * that moment is lost, so the press is repeated until the switch moves.
 */
const switchUntil = async (
  changes: Changes,
  control: Locator,
  checked: boolean
) => {
  await expect
    .poll(() => changes.signedIn, { timeout: ANSWER_MILLISECONDS })
    .toBe(true);
  await expect(async () => {
    if ((await control.isChecked()) !== checked) {
      await control.click();
    }
    await expect(control).toBeChecked({ checked, timeout: 1000 });
  }).toPass({ timeout: ANSWER_MILLISECONDS });
};

const addMemory = Effect.fn("NakafaE2E.addMemory")(function* (
  page: Page,
  changes: Changes
) {
  yield* Effect.promise(async () => {
    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    // Where there is room for a word the button says what it adds. On a phone
    // it is the plus alone.
    const add = page.getByRole("button", { name: "Add memory" });
    await expect(add.getByText("Memory", { exact: true })).toBeVisible({
      visible: (page.viewportSize()?.width ?? 0) >= LABEL_WIDTH,
    });
    await add.click();

    const editor = editorOf(page);
    const row = memoryRow(page, WRITTEN);
    const remove = page.getByRole("button", { exact: true, name: "Delete" });
    await opened(page, "");
    await expect(page.getByText("0 / 2,000")).toBeVisible();
    // A new memory with no words yet has nothing to delete.
    await expect(remove).toBeDisabled();

    // The editor has no Save: the words are stored a moment after the last key.
    const before = changes.sent;
    await page.keyboard.type(WRITTEN);
    await expect(page.getByText(`${WRITTEN.length} / 2,000`)).toBeVisible();
    await expect(remove).toBeEnabled();
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
    await opened(page, WRITTEN);
    await expect(title).toHaveValue("");
    const named = changes.sent;
    await title.fill(NAMED);
    await saved(changes, named);
    await title.press("Enter");
    await expect(editor).toBeFocused();

    // The learner replaces the words by hand: a programmatic fill within a
    // moment of the focus moving in would race the editor's own selection.
    // Closing the editor right after the last key still stores the words.
    const before = changes.sent;
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(REWRITTEN);
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(editor).toHaveCount(0);
    await saved(changes, before);
    // The list now calls the memory by its title.
    await expect(row).toBeVisible();
    await reloadUntil(page, () => expect(row).toBeVisible({ timeout: 3000 }));

    // The row's own action opens it too, with the title and the words it kept.
    await row.hover();
    await row.getByRole("button", { name: "Edit memory" }).click();
    await opened(page, REWRITTEN);
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
    await switchUntil(changes, remember, true);
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
    await opened(page, REWRITTEN);
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
  const changes = yield* openMemoryPage(page, baseURL);

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

/**
 * Writes a memory where the marks have no room in the editor's row and sit
 * behind More. The groups stay open while the learner writes the address of a
 * link, and close once a control has acted on the text.
 */
const formatBehindMore = Effect.fn("NakafaE2E.formatBehindMore")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(async () => {
    const editor = editorOf(page);
    const more = page
      .getByRole("toolbar")
      .getByRole("button", { exact: true, name: "More" });
    const bold = page.getByRole("button", { exact: true, name: "Bold" });
    const link = page.getByRole("button", { exact: true, name: "Link" });
    const address = page.getByRole("textbox", { exact: true, name: "Link" });

    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await page.keyboard.type(WRITTEN);
    await page.keyboard.press("ControlOrMeta+a");

    // The link control opens its own field, and a press in that field keeps
    // the groups it came from open.
    await more.click();
    await link.click();
    await expect(address).toBeFocused();
    await address.click();
    await address.fill(LINKED);
    await expect(link).toBeVisible();

    // Applying the link closes the field and the groups.
    const before = changes.sent;
    await address.press("Enter");
    await expect(address).toHaveCount(0);
    await expect(link).toHaveCount(0);
    await expect(editor.getByRole("link", { name: WRITTEN })).toHaveAttribute(
      "href",
      LINKED
    );
    await saved(changes, before);

    // A control that acts at once closes the groups, and the caret is back in
    // the text.
    await more.click();
    await bold.click();
    await expect(bold).toHaveCount(0);
    await expect(editor).toBeFocused();
    await expect(editor.locator("strong")).toHaveText(WRITTEN);
  });
});

test.describe("Memory editor at 320px", () => {
  test.use({ viewport: { height: 900, width: 320 } });

  test("keeps the controls behind More open for a link and closes them after it", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => formatBehindMore(page, origin))
        )
      )
    );
  });
});
