import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  ANSWER,
  answerMessage,
  BREAKABLE_TEX,
  FITTING_TEX,
  GERMAN_SUGGESTIONS,
  learnerMessage,
  rowOf,
  UNBREAKABLE_TEX,
} from "@/e2e/support/prose";
import { openServedChat, ROW } from "@/e2e/support/serve";

/** The answers of one chat, each after a question of its own. */
const TURNS = [
  "formulas",
  "code",
  "link",
  "nested",
  "table",
  "arabic",
  "diagramPlain",
  "diagramBroken",
] as const;

type Turn = (typeof TURNS)[number];

const ANSWERS = Arr.flatMap(TURNS, (name, index) => [
  learnerMessage({ order: index + 1, text: `Pertanyaan ${index + 1}` }),
  answerMessage({
    markdown: ANSWER[name],
    order: index + 1,
    // The follow-up questions a model writes come under its last answer.
    ...(name === "nested" ? { suggestions: GERMAN_SUGGESTIONS } : {}),
  }),
]);

/**
 * The row of the answer to one question, drawn and ready to measure. A row
 * that is out of sight is not rendered at all, so it is scrolled to again
 * until it has drawn.
 */
const answerRow = async (page: Page, name: Turn) => {
  // Each turn is two rows: the question, and then its answer.
  const row = page.locator(ROW).nth(rowOf(TURNS, name) * 2 + 1);

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

/** Where a formula of the answer stands, found by the TeX it was written in. */
const formulaFacts = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    if (!katex) {
      return null;
    }
    const column = element.getBoundingClientRect();
    const bases = Array.from(katex.querySelectorAll(".katex-base"));
    const widest = bases.reduce((best, base) =>
      base.getBoundingClientRect().width > best.getBoundingClientRect().width
        ? base
        : best
    );
    // The nearest box above the formula that scrolls sideways, if it has to.
    let box: Element | null = null;
    for (
      let node = widest.parentElement;
      node && node !== element;
      node = node.parentElement
    ) {
      const overflow = getComputedStyle(node).overflowX;
      if (
        (overflow === "auto" || overflow === "scroll") &&
        node.scrollWidth > node.clientWidth
      ) {
        box = node;
        break;
      }
    }
    const before = {
      boxWidth: box ? box.getBoundingClientRect().width : 0,
      column: column.width,
      inColumn: bases.every(
        (base) => base.getBoundingClientRect().right <= column.right + 0.5
      ),
      scrolls: box !== null,
      widest: widest.getBoundingClientRect().width,
    };
    if (box) {
      box.scrollLeft = box.scrollWidth;
    }
    return {
      ...before,
      // How far the end of the widest piece stands past the box, or the column.
      pastEnd:
        widest.getBoundingClientRect().right -
        (box ?? element).getBoundingClientRect().right,
    };
  }, tex);

/** How far above the text's baseline the first base of a formula stands, in pixels. */
const baselineOffset = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    const paragraph = katex?.closest("p");
    const base = katex?.querySelector(".katex-base");
    if (!(katex && paragraph && base)) {
      return Number.NaN;
    }
    // The child of the paragraph that holds the formula, whatever wraps it.
    let wrapper: Element = katex;
    while (wrapper.parentElement && wrapper.parentElement !== paragraph) {
      wrapper = wrapper.parentElement;
    }
    // A box with no size sits on the baseline of the line it is in.
    const probe = () => {
      const node = document.createElement("i");
      node.style.cssText = "display:inline-block;width:0;height:0";
      return node;
    };
    const inText = paragraph.insertBefore(probe(), wrapper);
    const inFormula = base.insertBefore(probe(), base.firstChild);
    return (
      inFormula.getBoundingClientRect().bottom -
      inText.getBoundingClientRect().bottom
    );
  }, tex);

/** A formula wider than the column scrolls in a box no wider than the column; one that can break wraps; one that fits keeps the text's line. */
const placesFormulas = async (page: Page) => {
  const row = await answerRow(page, "formulas");
  const wide = await formulaFacts(row, UNBREAKABLE_TEX);
  const breakable = await formulaFacts(row, BREAKABLE_TEX);

  expect.soft(wide?.widest).toBeGreaterThan(wide?.column ?? 0);
  expect.soft(wide?.scrolls).toBe(true);
  expect.soft(wide?.boxWidth).toBeLessThanOrEqual(wide?.column ?? 0);
  // Scrolled to its end, the last piece of the formula is inside the box.
  expect.soft(wide?.pastEnd).toBeLessThanOrEqual(1);
  // KaTeX wraps the other after an operator, so every piece is inside the column.
  expect.soft(breakable?.inColumn).toBe(true);
  expect.soft(breakable?.scrolls).toBe(false);
  expect
    .soft(Math.abs(await baselineOffset(row, FITTING_TEX)))
    .toBeLessThanOrEqual(0.5);
};

/** A display formula scrolls in its own card, and nothing else scrolls sideways. */
const scrollsDisplayFormulas = async (page: Page) => {
  const row = await answerRow(page, "formulas");
  const facts = await row.evaluate((element) => {
    const card = element.querySelector(
      '[data-math-block] [data-slot="scroll-area-viewport"]'
    );
    const transcript = element.closest(
      '[data-slot="message-scroller-viewport"]'
    );
    return {
      card: (card?.scrollWidth ?? 0) - (card?.clientWidth ?? 0),
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      transcript:
        (transcript?.scrollWidth ?? 0) - (transcript?.clientWidth ?? 0),
    };
  });

  expect.soft(facts.card).toBeGreaterThan(0);
  expect.soft(facts.page).toBeLessThanOrEqual(0);
  expect.soft(facts.transcript).toBeLessThanOrEqual(0);
};

/** The header of a code block holds a language of eighteen characters and both controls. */
const keepsCodeControlsInside = async (page: Page) => {
  const row = await answerRow(page, "code");
  const past = await row.evaluate((element) => {
    const block = element.querySelector("[data-code-block-container]");
    const edge = block?.getBoundingClientRect().right ?? 0;
    return Array.from(
      element.querySelectorAll("[data-code-block-header] button"),
      (button) => button.getBoundingClientRect().right - edge
    );
  });

  expect.soft(past).toHaveLength(2);
  for (const beyond of past) {
    expect.soft(beyond).toBeLessThanOrEqual(0.5);
  }
};

/** A long link, four levels of list and a wide table stay in the column, the table inside a box that scrolls it. */
const keepsLongContentInTheColumn = async (page: Page) => {
  const beyond = async (name: Turn, selector: string) =>
    (await answerRow(page, name)).evaluate((element, query) => {
      const edge = element.getBoundingClientRect().right;
      return Math.max(
        ...Array.from(
          element.querySelectorAll(query),
          (node) => node.getBoundingClientRect().right - edge
        )
      );
    }, selector);
  const table = await (await answerRow(page, "table")).evaluate((element) => {
    const box = element.querySelector('[data-slot="table-container"]');
    return {
      scrolls: (box?.scrollWidth ?? 0) > (box?.clientWidth ?? 0),
      wider: (box?.scrollWidth ?? 0) > element.clientWidth,
    };
  });

  // The follow-up questions of an answer are full-width buttons, and German ones are long.
  const suggestions = await (await answerRow(page, "nested")).evaluate(
    (element, texts: readonly string[]) => {
      const edge = element.getBoundingClientRect().right;
      return Array.from(element.querySelectorAll("button"))
        .filter((button) => texts.includes(button.textContent?.trim() ?? ""))
        .map((button) => button.getBoundingClientRect().right - edge);
    },
    GERMAN_SUGGESTIONS
  );

  expect
    .soft(await beyond("link", 'a[data-nakafa="anchor"]'))
    .toBeLessThanOrEqual(0.5);
  expect
    .soft(await beyond("nested", '[data-nakafa="list-item"]'))
    .toBeLessThanOrEqual(0.5);
  expect.soft(table).toEqual({ scrolls: true, wider: true });
  expect.soft(suggestions).toHaveLength(GERMAN_SUGGESTIONS.length);
  for (const past of suggestions) {
    expect.soft(past).toBeLessThanOrEqual(0.5);
  }
};

/** Arabic starts at its own side: its full stop ends the line on the left, and its list keeps its marker room on the right. */
const startsArabicAtItsOwnSide = async (page: Page) => {
  const row = await answerRow(page, "arabic");
  const facts = await row.evaluate((element) => {
    const paragraph = element.querySelector('[data-nakafa="paragraph"]');
    const list = element.querySelector('[data-nakafa="ordered-list"]');
    const item = element.querySelector('[data-nakafa="list-item"]');
    // Where the first or the last character of a block stands, from the left.
    const letterLeft = (block: Element | null, last: boolean) => {
      const walker = document.createTreeWalker(
        block ?? element,
        NodeFilter.SHOW_TEXT
      );
      let found = walker.nextNode();
      for (
        let next = walker.nextNode();
        last && next;
        next = walker.nextNode()
      ) {
        found = next;
      }
      const at = last ? (found?.textContent?.length ?? 1) - 1 : 0;
      const range = document.createRange();
      range.setStart(found ?? element, at);
      range.setEnd(found ?? element, at + 1);
      return range.getBoundingClientRect().left;
    };
    const padding = list ? getComputedStyle(list) : null;
    return {
      firstLeft: letterLeft(paragraph, false),
      itemDirection: item ? getComputedStyle(item).direction : null,
      lastLeft: letterLeft(paragraph, true),
      paddingLeft: Number.parseFloat(padding?.paddingLeft ?? "NaN"),
      paddingRight: Number.parseFloat(padding?.paddingRight ?? "NaN"),
    };
  });

  expect.soft(facts.lastLeft).toBeLessThan(facts.firstLeft);
  expect.soft(facts.itemDirection).toBe("rtl");
  expect.soft(facts.paddingLeft).toBe(0);
  expect.soft(facts.paddingRight).toBeGreaterThan(0);
};

test.describe("Nina's answer", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px keeps formulas, code, links, lists, tables and Arabic in place", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(page, origin, ANSWERS);
        yield* Effect.promise(async () => {
          await test.step("place inline formulas", () => placesFormulas(page));
          await test.step("scroll display formulas in their cards", () =>
            scrollsDisplayFormulas(page));
          await test.step("keep the controls of a code block inside it", () =>
            keepsCodeControlsInside(page));
          await test.step("keep long content in the column", () =>
            keepsLongContentInTheColumn(page));
          await test.step("start Arabic at its own side", () =>
            startsArabicAtItsOwnSide(page));
        });
      })
    );
  });

  for (const [locale, words] of [
    [
      "de",
      {
        copy: "Code kopieren",
        description: "Die wichtigsten Ideen, visuell dargestellt.",
        download: "Datei herunterladen",
        error: "Dieses Diagramm konnte nicht gezeichnet werden.",
        expand: "Größeres Diagramm öffnen",
        show: "Code anzeigen",
        title: "Diagramm",
      },
    ],
    [
      "id",
      {
        copy: "Salin kode",
        description: "Gagasan utama ditampilkan secara visual.",
        download: "Unduh berkas",
        error: "Diagram ini belum bisa digambar.",
        expand: "Buka diagram yang lebih besar",
        show: "Tampilkan kode",
        title: "Diagram",
      },
    ],
  ] as const) {
    test(`at 390px says the words of a diagram and its controls in ${locale}`, async ({
      baseURL,
      page,
    }) => {
      await page.setViewportSize({ height: 900, width: 390 });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, ANSWERS, locale);
          yield* Effect.promise(async () => {
            const plain = await answerRow(page, "diagramPlain");
            const card = plain.locator('[data-nakafa="mermaid-card"]');
            const controls = card.getByRole("button");

            // Mermaid loads on demand: wait for the drawing, which has no words of its own.
            await expect(card.locator('[role="img"] svg')).toBeVisible({
              timeout: 30_000,
            });
            // The controls of a card have a name in the page's language.
            await expect(controls).toHaveCount(3);
            await expect
              .soft(card.getByRole("button", { name: words.expand }))
              .toBeVisible();
            await expect
              .soft(card.getByRole("button", { name: words.download }))
              .toBeVisible();
            await expect
              .soft(card.getByRole("button", { name: words.copy }))
              .toBeVisible();
            // A diagram the model gave no title or description takes the words of the page.
            await expect.soft(card).toContainText(words.title);
            await controls.first().click();
            await expect
              .soft(page.locator('[data-slot="dialog-description"]'))
              .toHaveText(words.description);
            await page.keyboard.press("Escape");

            // A diagram that cannot be drawn says so in the same words.
            const broken = await answerRow(page, "diagramBroken");
            await expect(broken.locator("details")).toBeVisible({
              timeout: 30_000,
            });
            await expect.soft(broken.getByText(words.error)).toBeVisible();
            await expect.soft(broken.getByText(words.show)).toBeVisible();
          });
        })
      );
    });
  }
});
