import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  EMPTY,
  editorOf,
  live,
  MEMORY_PATH,
  memoryRow,
  opened,
  openMemoryPage,
  saved,
} from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  namesAcrossHydration,
  namesOf,
  titleOf,
  writeWorst,
} from "@/e2e/support/worst";

const ARABIC = "نور الهدى عبد الرحمن";
const ADDRESS =
  "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved";
const SEARCH = { name: "Search memories" };

/**
 * What a learner writes that the Markdown which stores it holds in another
 * form: a plus sign, an ampersand, an angle bracket, a link with an ampersand,
 * two equals signs alone, Arabic, one long address, a divider that has no words
 * to show, and a title with no words.
 */
const WRITTEN = [
  { text: "I study C++ at university" },
  { text: "Q&A" },
  { text: "a < b" },
  { text: "https://example.com/a?x=1&y=2 and more" },
  { text: "==" },
  { text: ARABIC },
  { text: ADDRESS },
  { divider: true },
  { title: ARABIC },
] as const;

/** What the rows show for them, the newest first. */
const NAMES = [
  ARABIC,
  "Untitled",
  ADDRESS,
  ARABIC,
  "==",
  "https://example.com/a?x=1&y=2 and more",
  "a < b",
  "Q&A",
  "I study C++ at university",
];

/** The direction the browser gives each row's name, and the title of the row. */
const rowsOf = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main ul > li")].map((item) => {
      const name = item.querySelector("span");

      return {
        cut: name ? name.scrollWidth > name.clientWidth : false,
        dir: name?.getAttribute("dir") ?? null,
        direction: name ? getComputedStyle(name).direction : null,
        title: name?.getAttribute("title") ?? null,
      };
    })
  );

/** How many rows the list shows for the words in the search box. */
const foundBy = (page: Page, query: string) =>
  Effect.promise(async () => {
    await page.getByRole("searchbox", SEARCH).fill(query);
    await page.waitForTimeout(400);
    return (await namesOf(page)).length;
  });

/**
 * The rows say what the learner wrote and not the Markdown that stores it, the
 * search finds it, and the server's rows say the same as the browser's. A name
 * keeps the direction of its own words, a long address keeps its whole text in
 * its title, and words that show nothing are called Untitled.
 */
const verifyWords = Effect.fn("NakafaE2E.verifyWords")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(() =>
    expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => live(changes));
  yield* Effect.forEach(WRITTEN, (memory) => writeWorst(page, changes, memory));

  // The rows the browser just made, and the rows the server renders for them.
  expect(yield* Effect.promise(() => namesOf(page))).toEqual(NAMES);
  const across = yield* namesAcrossHydration(page, MEMORY_PATH);

  expect(across.served).toEqual(NAMES);
  expect(across.hydrated).toEqual(NAMES);
  expect(across.said).toEqual([]);

  const rows = yield* Effect.promise(() => rowsOf(page));

  expect(Arr.every(rows, ({ dir }) => dir === "auto")).toBe(true);
  expect(Arr.map(rows, ({ direction }) => direction)).toEqual(
    Arr.map(NAMES, (name) => (name === ARABIC ? "rtl" : "ltr"))
  );
  // A name too long for its row keeps its whole text in its title.
  expect(rows[2]?.cut).toBe(true);
  expect(rows[2]?.title).toBe(ADDRESS);
  expect(rows[1]?.title).toBe("Untitled");

  // The search reads what the rows say.
  yield* Effect.promise(() => live(changes));
  const found = yield* Effect.forEach(
    ["C++", "q&a", "a < b", "==", "&amp;", "&lt;", "example.com"],
    (query) => foundBy(page, query)
  );

  expect(found).toEqual([1, 1, 1, 1, 0, 0, 2]);
});

test.describe("Memory rows with the words learners write", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("say the words, find them, and say them as the server does", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyWords(page, origin))
        )
      )
    );
  });
});

const ENGLISH = "I like mathematics.";
const ARABIC_SENTENCE = "مرحبا، أنا أحب الرياضيات.";

/** The direction and the attribute of the title and of every paragraph of the open editor. */
const directionsOf = (page: Page) =>
  page.evaluate(() => {
    const title = document.querySelector('input[aria-label="Title"]');
    const root = document.querySelector('[aria-label="Memory text"]');

    return {
      blocks: [...(root?.children ?? [])].map((block) => ({
        dir: block.getAttribute("dir"),
        direction: getComputedStyle(block).direction,
      })),
      root: root?.getAttribute("dir") ?? null,
      title: title
        ? {
            dir: title.getAttribute("dir"),
            direction: getComputedStyle(title).direction,
          }
        : null,
    };
  });

/**
 * A title in Arabic and two paragraphs, one Arabic and one English, each take
 * the direction of their own words, and opening the memory again shows the
 * words as they were written: the direction is not part of what is stored.
 */
const verifyDirections = Effect.fn("NakafaE2E.verifyDirections")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(async () => {
    const editor = editorOf(page);
    const before = changes.sent;

    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");
    await titleOf(page).fill(ARABIC);
    await editor.focus();
    await page.keyboard.type(ARABIC_SENTENCE);
    await page.keyboard.press("Enter");
    await page.keyboard.type(ENGLISH);
    await expect(editor.locator("p")).toHaveCount(2);

    const open = await directionsOf(page);

    expect(open.root).toBe("auto");
    expect(open.title).toEqual({ dir: "auto", direction: "rtl" });
    expect(open.blocks).toEqual([
      { dir: "auto", direction: "rtl" },
      { dir: "auto", direction: "ltr" },
    ]);

    await editor.press("Escape");
    await expect(editor).toHaveCount(0);
    await saved(changes, before);
    await memoryRow(page, ARABIC).first().click();
    await opened(page, `${ARABIC_SENTENCE}${ENGLISH}`);
    expect(await editor.locator("p").allTextContents()).toEqual([
      ARABIC_SENTENCE,
      ENGLISH,
    ]);
    await expect(titleOf(page)).toHaveValue(ARABIC);
  });
});

test.describe("Memory editor with words in two scripts", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("gives the title and each paragraph the direction of its own words", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyDirections(page, origin))
        )
      )
    );
  });
});

/**
 * Words the editor once read as something else: a line that starts like the
 * item of a list, and a text that holds two pairs of plus signs with a space
 * inside each. A pair of equals signs cannot be typed here, because the editor
 * turns typed `== b ==` into a highlight as it turns `**b**` into bold;
 * `extensions.test.ts` covers the equals signs another writer stores.
 */
const LOOKALIKES = ["Dr. Budi sakit", "ok. saya", "I use C++ and C++20"];

/**
 * A learner writes the words, and opens each memory again. The editor shows
 * the words they wrote, as words: not a list without its first word, and not
 * an underline in the place of the signs.
 */
const verifyLookalikes = Effect.fn("NakafaE2E.verifyLookalikes")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(() =>
    expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() => live(changes));
  yield* Effect.forEach(LOOKALIKES, (text) =>
    writeWorst(page, changes, { text })
  );
  yield* Effect.promise(async () => {
    const editor = editorOf(page);

    for (const text of LOOKALIKES) {
      await memoryRow(page, text).getByText(text).click();
      await opened(page, text);
      await expect(editor.locator("ol, ul, u, mark")).toHaveCount(0);
      await expect(editor.locator("p")).toHaveCount(1);
      await editor.press("Escape");
      await expect(editor).toHaveCount(0);
    }
  });
  // Opening a memory and closing it again writes nothing, so the server's rows
  // are still the words the learner wrote.
  expect(yield* Effect.promise(() => namesOf(page))).toEqual(
    Arr.reverse(LOOKALIKES)
  );
});

test.describe("Memory editor with words that look like something else", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("shows the words as the learner wrote them", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyLookalikes(page, origin))
        )
      )
    );
  });
});
