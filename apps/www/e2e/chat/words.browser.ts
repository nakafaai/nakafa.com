import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  LEARNER_TEXT,
  learnerMessage,
  PASTED,
  pictures,
  rowOf,
  WORKSHEET_NAME,
  worksheet,
} from "@/e2e/support/prose";
import { openServedChat, ROW } from "@/e2e/support/serve";

/** What learners wrote and attached, one message of each, in the order the page shows them. */
const TRANSCRIPT = [
  ["one", { text: LEARNER_TEXT.one }],
  ["angle", { text: LEARNER_TEXT.angle }],
  ["relation", { text: LEARNER_TEXT.relation }],
  ["product", { text: LEARNER_TEXT.product }],
  ["ampersand", { text: LEARNER_TEXT.ampersand }],
  ["choices", { text: LEARNER_TEXT.choices }],
  ["indented", { text: LEARNER_TEXT.indented }],
  ["arabic", { text: LEARNER_TEXT.arabic }],
  ["arabicSentence", { text: LEARNER_TEXT.arabicSentence }],
  ["corners", { text: LEARNER_TEXT.corners }],
  ["link", { text: LEARNER_TEXT.link }],
  ["pasted", { text: PASTED }],
  ["pictures2", { files: pictures(2), text: "Dua foto" }],
  ["pictures5", { files: pictures(5), text: "Lima foto" }],
  ["worksheet", { files: [worksheet], text: WORKSHEET_NAME }],
] as const;

type Name = (typeof TRANSCRIPT)[number][0];

const NAMES = Arr.map(TRANSCRIPT, ([name]) => name);
const MESSAGES = Arr.map(TRANSCRIPT, ([, content], index) =>
  learnerMessage({ ...content, order: index + 1 })
);

/** The words of the short messages, which Markdown would read as markup. */
const SHORT = [
  "one",
  "angle",
  "relation",
  "product",
  "ampersand",
  "choices",
  "indented",
  "arabic",
  "arabicSentence",
  "corners",
  "link",
] as const;

/**
 * The row of one message, scrolled to where the page draws it. A row that is
 * out of sight is not rendered at all, which empties its `innerText`, and the
 * transcript scrolls back to its end while the pictures of other rows load, so
 * the row is scrolled to again until it has drawn.
 */
const rowOfMessage = async (page: Page, name: Name) => {
  const row = page.locator(ROW).nth(rowOf(NAMES, name));

  await expect
    .poll(async () => {
      await row.scrollIntoViewIfNeeded();
      return row.evaluate(
        (element) =>
          element instanceof HTMLElement && element.innerText.length > 0
      );
    })
    .toBe(true);
  return row;
};

/** The text bubble of one message. */
const bubbleOf = async (page: Page, name: Name) =>
  (await rowOfMessage(page, name)).locator('[data-slot="bubble-content"]');

/**
 * The text the bubble of one message shows, as a reader sees it, with its line
 * breaks and spaces. The row is scrolled to and drawn in the same call that
 * reads it: the transcript can scroll back to its end between two calls while
 * the pictures of other rows load, and a row out of sight has no `innerText`.
 */
const shownText = (page: Page, name: Name) =>
  page
    .locator(ROW)
    .nth(rowOf(NAMES, name))
    .evaluate(async (row) => {
      row.scrollIntoView({ block: "center" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      const bubble = row.querySelector('[data-slot="bubble-content"]');
      return bubble instanceof HTMLElement ? bubble.innerText : "";
    });

/** The height of an element, in pixels. */
const heightOf = (element: Locator) =>
  element.evaluate((node) => node.getBoundingClientRect().height);

/** Nothing the learner wrote is read as Markdown, a link or a formula, and every word stays. */
const showsAsWritten = async (page: Page) => {
  for (const name of SHORT) {
    await expect.soft
      .poll(() => shownText(page, name), name)
      .toBe(LEARNER_TEXT[name]);
    await expect
      .soft(
        (await bubbleOf(page, name)).locator(
          "em, strong, code, pre, a, ul, ol, h1, h2, h3"
        )
      )
      .toHaveCount(0);
  }

  // A message of one word is one line tall, as it was: its box adds nothing around its text.
  const one = await (await bubbleOf(page, "one")).evaluate((element) => {
    const style = getComputedStyle(element);
    const sides = [
      "borderTopWidth",
      "borderBottomWidth",
      "paddingTop",
      "paddingBottom",
    ] as const;
    return {
      height: element.getBoundingClientRect().height,
      line: Number.parseFloat(style.lineHeight),
      around: sides.reduce(
        (sum, side) => sum + Number.parseFloat(style[side]),
        0
      ),
    };
  });

  expect.soft(one.height).toBeCloseTo(one.line + one.around, 1);
};

/** One option on each of three lines, not one run-on line. */
const keepsLineBreaks = async (page: Page) => {
  const bubble = await bubbleOf(page, "choices");
  // Each line of the text is a box of its own, counted by where it starts.
  const lines = await bubble.evaluate((element) => {
    const tops = new Set<number>();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        tops.add(Math.round(rect.top));
      }
    }
    return tops.size;
  });

  expect.soft(lines).toBe(3);
};

/** The bubble clips what runs past it, so a long string that stays whole is one that wraps. */
const breaksLongStrings = async (page: Page) => {
  const bubble = await bubbleOf(page, "link");
  const clipped = await bubble.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  );

  expect.soft(clipped).toBeLessThanOrEqual(0);
  await expect.soft.poll(() => shownText(page, "link")).toBe(LEARNER_TEXT.link);
};

/** Where an Arabic sentence stands: it reads from the right, and its full stop ends it on the left. */
const takesItsOwnDirection = async (page: Page) => {
  const directionOf = async (name: Name) =>
    (await bubbleOf(page, name)).evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      let last = first;
      for (let next = walker.nextNode(); next; next = walker.nextNode()) {
        last = next;
      }
      const edge = (node: Node | null, offset: number) => {
        const range = document.createRange();
        range.setStart(node ?? element, offset);
        range.setEnd(node ?? element, offset + 1);
        return range.getBoundingClientRect();
      };
      // The element that carries the words' direction, if the page names one.
      const holder = element.querySelector("[dir]") ?? element;
      return {
        direction: getComputedStyle(holder).direction,
        // Where the first and the last character stand, left to right.
        firstLeft: edge(first, 0).left,
        lastLeft: edge(last, (last?.textContent?.length ?? 1) - 1).left,
      };
    });
  const english = await directionOf("angle");
  const arabic = await directionOf("arabicSentence");

  expect.soft(english.direction).toBe("ltr");
  expect.soft(english.lastLeft).toBeGreaterThan(english.firstLeft);
  expect.soft(arabic.direction).toBe("rtl");
  expect.soft(arabic.lastLeft).toBeLessThan(arabic.firstLeft);
};

/** A pasted message is no taller than the screen, shows twelve lines and opens on request. */
const foldsPastTwelveLines = async (page: Page) => {
  const short = await bubbleOf(page, "one");
  const long = await bubbleOf(page, "pasted");
  const toggle = long.getByRole("button", { name: "Show more" });
  const screen = page.viewportSize()?.height ?? 0;

  expect.soft(await heightOf(long)).toBeLessThan(screen);
  await expect.soft(short.getByRole("button")).toHaveCount(0);
  await expect.soft(toggle).toHaveAttribute("aria-expanded", "false");

  // The box shows twelve lines and holds the whole text, for find and for copy.
  const folded = await long.evaluate((element) => {
    const box = element.querySelector("[id]");
    if (!(box instanceof HTMLElement)) {
      return null;
    }
    return {
      clipped: box.scrollHeight > box.clientHeight,
      height: box.getBoundingClientRect().height,
      line: Number.parseFloat(getComputedStyle(box).lineHeight),
      text: box.textContent,
    };
  });
  expect.soft(folded?.height).toBeCloseTo((folded?.line ?? 0) * 12, 1);
  expect.soft(folded?.clipped).toBe(true);
  expect.soft(folded?.text).toBe(PASTED);

  await toggle.click({ timeout: 2000 }).catch(() => undefined);
  const open = long.getByRole("button", { name: "Show less" });
  await expect.soft(open).toHaveAttribute("aria-expanded", "true");
  expect.soft(await heightOf(long)).toBeGreaterThan(screen);

  await open.click({ timeout: 2000 }).catch(() => undefined);
  await expect.soft(toggle).toHaveAttribute("aria-expanded", "false");
  expect.soft(await heightOf(long)).toBeLessThan(screen);
};

/** A row of files starts at its first file and scrolls to the last; a row that fits ends where the message ends. */
const scrollsFilesFromTheFirst = async (page: Page) => {
  const measure = async (name: Name) =>
    (await rowOfMessage(page, name)).evaluate((row) => {
      const group = row.querySelector('[data-slot="attachment-group"]');
      const cards = () =>
        Array.from(row.querySelectorAll('[data-slot="attachment"]'), (card) =>
          card.getBoundingClientRect()
        );
      if (!group) {
        return null;
      }
      const box = group.getBoundingClientRect();
      const before = {
        // How far the last card stands from the end of the row.
        endGap: Math.abs(
          (cards().at(-1)?.right ?? 0) - row.getBoundingClientRect().right
        ),
        firstLeft: (cards().at(0)?.left ?? 0) - box.left,
        scrolls: group.scrollWidth > group.clientWidth,
      };

      group.scrollLeft = group.scrollWidth;
      return {
        ...before,
        lastInside:
          (cards().at(-1)?.right ?? Number.POSITIVE_INFINITY) - box.right,
      };
    });
  const two = await measure("pictures2");
  const five = await measure("pictures5");
  const one = await measure("worksheet");

  expect.soft(two?.firstLeft).toBeGreaterThanOrEqual(-0.5);
  expect.soft(two?.lastInside).toBeLessThanOrEqual(0.5);
  expect.soft(five?.firstLeft).toBeGreaterThanOrEqual(-0.5);
  expect.soft(five?.lastInside).toBeLessThanOrEqual(0.5);
  expect.soft(five?.scrolls).toBe(true);
  expect.soft(one?.scrolls).toBe(false);
  expect.soft(one?.endGap).toBeLessThanOrEqual(1);
};

test.describe("A learner's words", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px show as written, wrap, face their own way, fold and carry files", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(page, origin, MESSAGES);
        yield* Effect.promise(async () => {
          await test.step("show as the learner wrote them", () =>
            showsAsWritten(page));
          await test.step("keep their line breaks", () =>
            keepsLineBreaks(page));
          await test.step("break a long unbroken string", () =>
            breaksLongStrings(page));
          await test.step("take the direction of their own content", () =>
            takesItsOwnDirection(page));
          await test.step("fold past twelve lines and open on request", () =>
            foldsPastTwelveLines(page));
          await test.step("scroll a row of files from its first file", () =>
            scrollsFilesFromTheFirst(page));
        });
      })
    );
  });

  test("at 1440px fold and carry files the same way", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(page, origin, MESSAGES);
        yield* Effect.promise(async () => {
          await test.step("fold past twelve lines and open on request", () =>
            foldsPastTwelveLines(page));
          await test.step("scroll a row of files from its first file", () =>
            scrollsFilesFromTheFirst(page));
        });
      })
    );
  });

  for (const [locale, more, less] of [
    ["de", "Mehr anzeigen", "Weniger anzeigen"],
    ["id", "Lebih banyak", "Lebih sedikit"],
  ] as const) {
    test(`at 390px say the fold in ${locale}`, async ({ baseURL, page }) => {
      await page.setViewportSize({ height: 900, width: 390 });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, MESSAGES, locale);
          yield* Effect.promise(async () => {
            const bubble = await bubbleOf(page, "pasted");

            await bubble
              .getByRole("button", { name: more })
              .click({ timeout: 10_000 });
            await expect(
              bubble.getByRole("button", { name: less })
            ).toBeVisible();
          });
        })
      );
    });
  }
});
