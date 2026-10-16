import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { reloadUntil, saved } from "@/e2e/support/changes";
import { writeMemory } from "@/e2e/support/list";
import {
  editorOf,
  memoryRow,
  nameOf,
  openMemoryPage,
  panelOf,
  runMemory,
} from "@/e2e/support/memory";
import { holdChunks } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PLAIN = "Prefers worked examples before the formula";
/** A memory with a heading, a bulleted item and a bold word, typed with the Markdown shortcuts. */
const FORMATTED = "## Plan\n- Milk\n**Bread**";
/** The words of the heading in `FORMATTED`, which name its row. */
const PLAN = "Plan";
/** A memory with one task that is not done, typed with the Markdown shortcut of a task. */
const TASK = "[ ] Milk";
/** The words of the task in `TASK`, which name its row. */
const MILK = "Milk";

type Box = Awaited<ReturnType<Locator["boundingBox"]>>;

/** The heading, the bulleted item and the bold word of `FORMATTED`, inside the panel. */
const formattedWordsOf = (page: Page) => {
  const panel = panelOf(page);

  return {
    bold: panel.locator("strong"),
    heading: panel.locator("h2"),
    item: panel.getByText("Milk", { exact: true }),
  };
};

type FormattedWords = ReturnType<typeof formattedWordsOf>;

/** Where each word of `FORMATTED` stands, read once the page has placed it. */
const placesOf = async (words: FormattedWords) => ({
  bold: await words.bold.boundingBox(),
  heading: await words.heading.boundingBox(),
  item: await words.item.boundingBox(),
});

/** Checks that a word stands where it stood before, to the pixel. */
function expectSamePlace(settled: Box, placed: Box) {
  expect(settled?.x).toBeCloseTo(placed?.x ?? Number.NaN, 0);
  expect(settled?.y).toBeCloseTo(placed?.y ?? Number.NaN, 0);
  expect(settled?.width).toBeCloseTo(placed?.width ?? Number.NaN, 0);
  expect(settled?.height).toBeCloseTo(placed?.height ?? Number.NaN, 0);
}

/**
 * The editor's code loads when the learner opens it. Until it arrives, the box
 * shows the saved words as plain text in the same place, so nothing pops in,
 * and the editor takes the words' place without moving them.
 */
const showsSavedWordsWhileLoading = Effect.fn(
  "NakafaE2E.memoryShowsWordsWhileLoading"
)(function* (page: Page, baseURL: string) {
  const changes = yield* openMemoryPage(page, baseURL);
  const before = changes.sent;
  yield* writeMemory(page, PLAIN);

  yield* Effect.promise(async () => {
    await saved(changes, before);
    await reloadUntil(page, () =>
      expect(memoryRow(page, PLAIN)).toBeVisible({ timeout: 3000 })
    );
  });

  // The editor's code is the chunk that loads on the press, and it waits here.
  const release = yield* holdChunks(page);

  yield* Effect.promise(async () => {
    await nameOf(page, PLAIN).click();

    const words = panelOf(page).getByText(PLAIN, { exact: true });
    await expect(words).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(editorOf(page)).toHaveCount(0);
    const placed = await words.boundingBox();

    await release();
    await expect(editorOf(page)).toHaveText(PLAIN, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(words).toHaveCount(1);
    const settled = await words.boundingBox();

    expect(settled?.y).toBeCloseTo(placed?.y ?? Number.NaN, 0);
    expect(settled?.x).toBeCloseTo(placed?.x ?? Number.NaN, 0);
  });
});

/**
 * Formatted words keep their place: the heading, the bulleted item and the bold
 * word stand where the editor puts them, so the editor takes their place without
 * moving any of them.
 */
const keepsFormattedWords = Effect.fn("NakafaE2E.memoryKeepsFormattedWords")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);
    const before = changes.sent;
    yield* writeMemory(page, FORMATTED);

    yield* Effect.promise(async () => {
      await saved(changes, before);
      await reloadUntil(page, () =>
        expect(memoryRow(page, PLAN)).toBeVisible({ timeout: 3000 })
      );
    });

    // The editor's code is the chunk that loads on the press, and it waits here.
    const release = yield* holdChunks(page);

    yield* Effect.promise(async () => {
      await nameOf(page, PLAN).click();

      const placed = formattedWordsOf(page);
      await expect(placed.heading).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(editorOf(page)).toHaveCount(0);
      const placedAt = await placesOf(placed);

      await release();
      await expect(editorOf(page).locator("strong")).toHaveText("Bread", {
        timeout: readinessTimeoutMilliseconds,
      });
      const settledAt = await placesOf(formattedWordsOf(page));

      expectSamePlace(settledAt.bold, placedAt.bold);
      expectSamePlace(settledAt.heading, placedAt.heading);
      expectSamePlace(settledAt.item, placedAt.item);
    });
  }
);

/**
 * A task box that the learner clicks while the editor's code loads keeps its
 * check: the saved box takes no change, and the editor shows the same check
 * when it arrives.
 */
const keepsTheTaskCheck = Effect.fn("NakafaE2E.memoryKeepsTaskCheck")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);
    const before = changes.sent;
    yield* writeMemory(page, TASK);

    yield* Effect.promise(async () => {
      await saved(changes, before);
      await reloadUntil(page, () =>
        expect(memoryRow(page, MILK)).toBeVisible({ timeout: 3000 })
      );
    });

    // The editor's code is the chunk that loads on the press, and it waits here.
    const release = yield* holdChunks(page);

    yield* Effect.promise(async () => {
      await nameOf(page, MILK).click();

      const box = panelOf(page).getByRole("checkbox");
      await expect(box).toBeVisible({ timeout: readinessTimeoutMilliseconds });
      await expect(box).not.toBeChecked();
      // The label wraps the box, so a click on the label is a click on the box.
      await panelOf(page).locator('[data-type="taskItem"] label').click();
      await expect(box).not.toBeChecked();

      await release();
      await expect(panelOf(page).getByRole("checkbox")).not.toBeChecked({
        timeout: readinessTimeoutMilliseconds,
      });
    });
  }
);

/**
 * Records, in the document, the text of the editor's element the moment the page
 * first adds it. A frame cannot show the editor empty when the element arrives
 * with its words.
 */
function recordArrival() {
  const observer = new MutationObserver(() => {
    const editor = document.querySelector('[data-slot="editor"]');
    if (editor === null) {
      return;
    }
    document.documentElement.dataset.arrived =
      editor.querySelector(".ProseMirror")?.textContent ?? "";
    observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * The editor takes the place of the saved words with its words already in it:
 * the words are not in a later frame than the editor. At 768px the toolbar does
 * not wrap, the layout in which the editor used to show empty for a moment.
 */
const showsWordsOnArrival = Effect.fn("NakafaE2E.memoryShowsWordsOnArrival")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);
    const before = changes.sent;
    yield* writeMemory(page, PLAIN);

    yield* Effect.promise(async () => {
      await saved(changes, before);
      await reloadUntil(page, () =>
        expect(memoryRow(page, PLAIN)).toBeVisible({ timeout: 3000 })
      );

      await page.evaluate(recordArrival);
      await nameOf(page, PLAIN).click();
      await expect(editorOf(page)).toHaveText(PLAIN, {
        timeout: readinessTimeoutMilliseconds,
      });
      const arrived = await page.evaluate(
        () => document.documentElement.dataset.arrived
      );
      expect(arrived).toBe(PLAIN);
    });
  }
);

test.describe("Memory editor's saved words at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows the saved words as plain text while the editor's code loads", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, showsSavedWordsWhileLoading);
  });

  test("shows formatted words where the editor puts them while its code loads", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, keepsFormattedWords);
  });

  test("keeps the check of a task that is clicked while the editor's code loads", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, keepsTheTaskCheck);
  });
});

test.describe("Memory editor's first frame at 768px", () => {
  test.use({ viewport: { height: 900, width: 768 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows the saved words in the first frame the editor draws", async ({
    baseURL,
    page,
  }) => {
    await runMemory(page, baseURL, showsWordsOnArrival);
  });
});
