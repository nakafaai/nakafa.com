import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, MutableList, Schema } from "effect";
import { type Changes, live, saved } from "@/e2e/support/changes";
import {
  EMPTY,
  editorOf,
  memoryRow,
  opened,
  openMemoryPage,
} from "@/e2e/support/memory";
import { CARD } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { firstRow } from "@/e2e/support/window";

/** The title of a memory in its editor. */
export const titleOf = (page: Page) =>
  page.getByRole("textbox", { exact: true, name: "Title" });

/** The names the rows of the list show, newest first. */
export const namesOf = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main ul > li")].map(
      (item) => item.querySelector("span")?.textContent ?? ""
    )
  );

/** The width of an element in pixels, or none when it is not in the page. */
export const widthOf = async (element: Locator) =>
  (await element.boundingBox())?.width ?? 0;

/**
 * Whether the words of a line that match `words` are shown whole. A line that
 * fits shows them. A line that is cut at its end shows them when they end with
 * room left for the ellipsis that replaces the rest. The line is measured in
 * the face the learner sees, once the page's fonts have loaded.
 */
export const wordsShown = (line: Locator, words: RegExp) =>
  line.evaluate(async (element, source) => {
    await document.fonts.ready;
    const text = element.firstChild;
    const found = new RegExp(source, "u").exec(text?.textContent ?? "");
    const context = document.createElement("canvas").getContext("2d");

    if (!(text instanceof Text && found && context)) {
      return false;
    }
    if (element.scrollWidth <= element.clientWidth) {
      return true;
    }

    const range = document.createRange();

    range.setStart(text, found.index);
    range.setEnd(text, found.index + found[0].length);
    context.font = getComputedStyle(element).font;

    return (
      range.getBoundingClientRect().right + context.measureText("…").width <=
      element.getBoundingClientRect().right
    );
  }, words.source);

/** The card that holds the search and the list, the second card of the page. */
export const listCard = (page: Page) =>
  page.locator(`main ${CARD}`).filter({ has: page.getByRole("searchbox") });

/** The card that turns memory on and off and holds the Delete all button. */
export const controlCard = (page: Page) =>
  page.locator(`main ${CARD}`).filter({ has: page.getByRole("switch") });

/**
 * What a memory is written with: its title, its words, and whether the divider
 * of the toolbar is pressed in it. Every field is optional, and a memory with
 * none of them is a new memory that was never given a word.
 */
const Written = Schema.Struct({
  divider: Schema.optionalKey(Schema.Boolean),
  text: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
});

/**
 * Writes one memory as a learner does: Add, a title, the words and the divider,
 * and Escape, which closes the editor and stores the memory at once. It waits
 * for the server to answer, so the next memory is written after this one.
 */
export const writeWorst = Effect.fn("NakafaE2E.writeWorst")(function* (
  page: Page,
  changes: Changes,
  { divider, text, title }: typeof Written.Type
) {
  yield* Effect.promise(async () => {
    const editor = editorOf(page);
    const before = changes.sent;

    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    if (title !== undefined) {
      await titleOf(page).fill(title);
      await editor.focus();
    }
    if (text !== undefined) {
      await page.keyboard.type(text);
    }
    if (divider === true) {
      // At the width of the panel the blocks may sit behind More, where the divider keeps its
      // own control.
      const more = page
        .getByRole("toolbar")
        .getByRole("button", { exact: true, name: "More" });

      if (await more.isVisible()) {
        await more.click();
      }
      await page.getByRole("button", { exact: true, name: "Divider" }).click();
    }
    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
    await saved(changes, before);
  });
});

/** The resizer at the edge of the panel, which names its width and its bounds. */
export const resizerOf = (page: Page) =>
  page.getByRole("separator", { name: "Change width" });

/**
 * Signs a learner in, writes one memory with `words` and opens it, so that the
 * editor is a panel beside the list. It returns what the page changes.
 */
export const openedPanel = Effect.fn("NakafaE2E.openedPanel")(function* (
  page: Page,
  baseURL: string,
  words: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(() =>
    expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => live(changes));
  yield* writeWorst(page, changes, { text: words });
  yield* Effect.promise(async () => {
    await memoryRow(page, words).getByText(words).click();
    await opened(page, words);
  });
  return changes;
});

/** Presses a key on the focused element `times` times. */
export const pressTimes = Effect.fn("NakafaE2E.pressTimes")(function* (
  page: Page,
  key: string,
  times: number
) {
  yield* Effect.promise(async () => {
    for (let press = 0; press < times; press += 1) {
      await page.keyboard.press(key);
    }
  });
});

/**
 * Loads the Memory page and reads the names of its rows in the first frame that
 * draws them and again once the page has settled, and says what the console had
 * to say on the way. The account screens render in the browser only (ADR 0038
 * D2), so the first frame with rows is the first render of the list.
 */
export const namesAsDrawn = Effect.fn("NakafaE2E.namesAsDrawn")(function* (
  page: Page,
  path: string
) {
  return yield* Effect.promise(async () => {
    const said = MutableList.make<string>();
    const listen = (message: { text: () => string; type: () => string }) => {
      if (message.type() === "error" || message.type() === "warning") {
        MutableList.append(said, `${message.type()}: ${message.text()}`);
      }
    };

    page.on("console", listen);
    const watch = await page.addInitScript(() => {
      const look = () => {
        const rows = [...document.querySelectorAll("main ul > li")];
        if (rows.length > 0) {
          Reflect.set(
            window,
            "nakafaFirstNames",
            rows.map((item) => item.querySelector("span")?.textContent ?? "")
          );
          return;
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.goto(path);
    await expect(firstRow(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.waitForLoadState("networkidle");
    const first = await page.evaluate(() =>
      Reflect.get(window, "nakafaFirstNames")
    );
    page.off("console", listen);
    await watch.dispose();

    return {
      first,
      said: MutableList.toArray(said),
      settled: await namesOf(page),
    };
  });
});
