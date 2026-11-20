import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { reloadUntil, saved } from "@/e2e/support/changes";
import { runOnPage } from "@/e2e/support/chat";
import { writeMemory } from "@/e2e/support/list";
import {
  editorOf,
  MEMORY_PATH,
  memoryRow,
  nameOf,
  openMemoryPage,
  panelOf,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { holdChunks } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const PLAIN = "Prefers worked examples before the formula";
/** A memory with a heading, a bulleted item and a bold word, typed with the Markdown shortcuts. */
const FORMATTED = "## Plan\n- Milk\n**Bread**";
/** The words of the heading in `FORMATTED`, which name its row. */
const PLAN = "Plan";
/** A memory with one task that is not done, typed with the Markdown shortcut of a task. */
const TASK = "[ ] Milk";
/** The words of the task in `TASK`, which name its row. */
const MILK = "Milk";
/**
 * The class that `prosemirror-view` adds to the editor when it hides the
 * selection. Only the editor's libraries hold this name, and the static preview
 * loads none of them, so a chunk that holds the name is the editor's code.
 */
const EDITOR_CODE_MARKER = "ProseMirror-hideselection";

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
    // The page's own code has to run before the chunks are held, or the press
    // lands on the server's row and opens nothing.
    await waitUntilTakenOver(nameOf(page, PLAIN));
  });

  // Every chunk of the page waits here, so the saved words are all the box shows.
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
 * Opens the Memory page of the same learner in a new browser context, with the
 * editor's code held until the `release` it returns runs, and waits until the
 * page's own code can take a press on the row named `name`. The page that wrote
 * the memory loaded the editor's code already, and WebKit serves a chunk it
 * holds without asking any route, so only a context with an empty cache fetches
 * the code where the hold can stop it. The hold starts before the page loads:
 * a pointer over a memory or the Add button starts loading the editor's code.
 * The context closes with the scope.
 */
const openUncached = Effect.fn("NakafaE2E.memoryOpenUncached")(function* (
  page: Page,
  name: string
) {
  const browser = yield* Effect.fromNullishOr(page.context().browser());
  const storageState = yield* Effect.promise(() =>
    page.context().storageState()
  );
  const context = yield* Effect.acquireRelease(
    Effect.promise(() =>
      browser.newContext({
        storageState,
        viewport: page.viewportSize(),
      })
    ),
    (opened) => Effect.promise(() => opened.close())
  );
  const fresh = yield* Effect.promise(() => context.newPage());
  const release = yield* holdChunks(fresh, {
    containing: EDITOR_CODE_MARKER,
  });
  yield* Effect.promise(async () => {
    await fresh.goto(MEMORY_PATH);
    await expect(memoryRow(fresh, name)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await waitUntilTakenOver(nameOf(fresh, name));
  });
  return { fresh, release };
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
    yield* Effect.promise(() => saved(changes, before));

    // The editor's code waits, and the preview's code loads on the press.
    const { fresh, release } = yield* openUncached(page, PLAN);

    yield* withObservedPageErrors(
      fresh,
      Effect.promise(async () => {
        await nameOf(fresh, PLAN).click();

        const placed = formattedWordsOf(fresh);
        await expect(placed.heading).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(editorOf(fresh)).toHaveCount(0);
        const placedAt = await placesOf(placed);

        await release();
        await expect(editorOf(fresh).locator("strong")).toHaveText("Bread", {
          timeout: readinessTimeoutMilliseconds,
        });
        const settledAt = await placesOf(formattedWordsOf(fresh));

        expectSamePlace(settledAt.bold, placedAt.bold);
        expectSamePlace(settledAt.heading, placedAt.heading);
        expectSamePlace(settledAt.item, placedAt.item);
      })
    );
  },
  Effect.scoped
);

/**
 * A task box is the design system's check box, named by the task's words, in the
 * saved words and in the editor alike: the browser draws no box of its own. A box
 * that the learner clicks while the editor's code loads keeps its check, because
 * the saved box takes no change; the editor shows the same check when it arrives,
 * and its box checks the task.
 */
const keepsTheTaskCheck = Effect.fn("NakafaE2E.memoryKeepsTaskCheck")(
  function* (page: Page, baseURL: string) {
    const changes = yield* openMemoryPage(page, baseURL);
    const before = changes.sent;
    yield* writeMemory(page, TASK);
    yield* Effect.promise(() => saved(changes, before));

    // The editor's code waits, and the preview's code loads on the press.
    const { fresh, release } = yield* openUncached(page, MILK);

    yield* withObservedPageErrors(
      fresh,
      Effect.promise(async () => {
        await nameOf(fresh, MILK).click();

        const box = panelOf(fresh).getByRole("checkbox", { name: MILK });
        await expect(box).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(box).toHaveAttribute("data-slot", "checkbox");
        await expect(box).not.toBeChecked();
        await box.click();
        await expect(box).not.toBeChecked();
        await expect(editorOf(fresh)).toHaveCount(0);

        await release();
        await expect(editorOf(fresh)).toContainText(MILK, {
          timeout: readinessTimeoutMilliseconds,
        });
        const task = editorOf(fresh).getByRole("checkbox", { name: MILK });
        await expect(task).toHaveAttribute("data-slot", "checkbox");
        await expect(task).not.toBeChecked();
        await task.click();
        await expect(task).toBeChecked();
        await expect(
          editorOf(fresh).locator('[data-type="taskItem"]')
        ).toHaveAttribute("data-checked", "true");
      })
    );
  },
  Effect.scoped
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

      await waitUntilTakenOver(nameOf(page, PLAIN));
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
    await runOnPage(page, baseURL, (origin) =>
      showsSavedWordsWhileLoading(page, origin)
    );
  });

  test("shows formatted words where the editor puts them while its code loads", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      keepsFormattedWords(page, origin)
    );
  });

  test("keeps the check of a task that is clicked while the editor's code loads", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => keepsTheTaskCheck(page, origin));
  });
});

test.describe("Memory editor's first frame at 768px", () => {
  test.use({ viewport: { height: 900, width: 768 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows the saved words in the first frame the editor draws", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      showsWordsOnArrival(page, origin)
    );
  });
});
