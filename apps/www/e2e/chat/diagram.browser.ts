import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "../support/chat";
import {
  ANSWER,
  answerTurn,
  chatOf,
  DIAGRAM_DESCRIPTION,
  DIAGRAM_TITLE,
} from "../support/prose";
import { settled } from "../support/rows";
import { drawnRow, openServedChat } from "../support/serve";
import { revealTimeoutMilliseconds } from "../support/timeout";

/** A diagram with no title or description, one that cannot be drawn, and one with a title and a description. */
const PLAIN = answerTurn({ markdown: ANSWER.diagramPlain, order: 1 });
const BROKEN = answerTurn({ markdown: ANSWER.diagramBroken, order: 2 });
const TITLED = answerTurn({ markdown: ANSWER.diagram, order: 3 });

/**
 * What the page says around a diagram, in each language it has: the names of
 * the three controls of the card, the title and the description of a diagram
 * the model gave neither, the words of a diagram that cannot be drawn, and the
 * word for its code. Indonesian writes `Diagram` as English does, so there only
 * the description tells the page's words from the English ones.
 */
const LANGUAGES = [
  {
    copy: "Code kopieren",
    description: "Die wichtigsten Ideen, visuell dargestellt.",
    download: "Datei herunterladen",
    error: "Dieses Diagramm konnte nicht gezeichnet werden.",
    expand: "Größeres Diagramm öffnen",
    locale: "de",
    show: "Code anzeigen",
    title: "Diagramm",
  },
  {
    copy: "Salin kode",
    description: "Gagasan utama ditampilkan secara visual.",
    download: "Unduh berkas",
    error: "Diagram ini belum bisa digambar.",
    expand: "Buka diagram yang lebih besar",
    locale: "id",
    show: "Tampilkan kode",
    title: "Diagram",
  },
];

/**
 * How the card draws its diagram: whether the whole drawing fits its stage
 * without a scrollbar.
 */
const cardFacts = (wrapper: Element) => {
  const svg = wrapper.querySelector("svg");
  const drawing = svg?.getBoundingClientRect();
  const stage = wrapper.getBoundingClientRect();

  return {
    fits: drawing
      ? drawing.left >= stage.left - 0.5 &&
        drawing.right <= stage.right + 0.5 &&
        drawing.top >= stage.top - 0.5 &&
        drawing.bottom <= stage.bottom + 0.5
      : false,
    scrolls:
      wrapper.scrollWidth > wrapper.clientWidth ||
      wrapper.scrollHeight > wrapper.clientHeight,
  };
};

/**
 * How the dialog draws its diagram. The label's own font size is 16 pixels in
 * the diagram's units; drawn at its natural size, the page shows it at that
 * size. The box scrolls when the drawing is wider than it, and centres the
 * drawing when the drawing is smaller.
 */
const dialogFacts = (box: Element) => {
  const svg = box.querySelector("svg");
  const label = svg?.querySelector(".nodeLabel");
  const drawing = svg?.getBoundingClientRect();
  const frame = box.getBoundingClientRect();
  const style = getComputedStyle(box);
  const fontPixels = label
    ? Number.parseFloat(getComputedStyle(label).fontSize)
    : Number.NaN;

  return {
    // The width the drawing can fill without scrolling: the box less its padding.
    contentWidth:
      box.clientWidth -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight),
    centred: drawing
      ? Math.abs(drawing.left - frame.left - (frame.right - drawing.right)) <= 1
      : false,
    drawingWidth: drawing?.width ?? Number.NaN,
    fontPixels,
    renderedPixels: fontPixels * (svg?.getScreenCTM()?.a ?? Number.NaN),
    scrolls: box.scrollWidth > box.clientWidth,
    viewBoxWidth: svg?.viewBox.baseVal.width ?? Number.NaN,
  };
};

test.describe("The dialog of a diagram", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const width of [390, 1440]) {
    test(`at ${width}px shows the diagram at its natural size`, async ({
      baseURL,
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, chatOf([TITLED]));
          yield* Effect.promise(async () => {
            const titled = await drawnRow(page, TITLED.answer);
            const card = titled.locator('[data-nakafa="mermaid-card"]');
            const wrapper = card.getByRole("img", { name: DIAGRAM_TITLE });

            await expect(wrapper.locator("svg")).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            // The card keeps the whole diagram in its stage, with no scrollbar.
            const preview = await wrapper.evaluate(cardFacts);
            expect.soft(preview.fits).toBe(true);
            expect.soft(preview.scrolls).toBe(false);

            await card.getByRole("button").first().click();
            const dialog = page.getByRole("dialog");
            const box = dialog.getByRole("img", { name: DIAGRAM_TITLE });
            await expect(box.locator("svg")).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            // The dialog zooms in when it opens, and a drawing measured during the zoom is scaled.
            await settled(box);
            const facts = await box.evaluate(dialogFacts);

            // A label keeps its own font size, so the drawing is not scaled.
            expect.soft(facts.fontPixels).toBeGreaterThan(0);
            expect
              .soft(Math.abs(facts.renderedPixels - facts.fontPixels))
              .toBeLessThanOrEqual(1);
            expect
              .soft(Math.abs(facts.drawingWidth - facts.viewBoxWidth))
              .toBeLessThanOrEqual(1);
            // A wider drawing scrolls in its box, and a narrower one sits in the middle.
            expect
              .soft(facts.scrolls)
              .toBe(facts.drawingWidth > facts.contentWidth);
            expect
              .soft(facts.centred || facts.drawingWidth > facts.contentWidth)
              .toBe(true);
          });
        })
      );
    });
  }
});

test.describe("The words of a diagram", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const language of LANGUAGES) {
    test(`at 390px are the words of the page in ${language.locale}`, async ({
      baseURL,
      page,
    }) => {
      await page.setViewportSize({ height: 900, width: 390 });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(
            page,
            origin,
            chatOf([PLAIN, BROKEN, TITLED]),
            language.locale
          );
          yield* Effect.promise(async () => {
            const plain = await drawnRow(page, PLAIN.answer);
            const card = plain.locator('[data-nakafa="mermaid-card"]');
            const controls = card.getByRole("button");

            // Mermaid loads on demand: wait for the drawing, which has no words of its own.
            await expect(card.locator('[role="img"] svg')).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            // The controls of a card have a name in the page's language.
            await expect(controls).toHaveCount(3);
            await expect
              .soft(card.getByRole("button", { name: language.expand }))
              .toBeVisible();
            await expect
              .soft(card.getByRole("button", { name: language.download }))
              .toBeVisible();
            await expect
              .soft(card.getByRole("button", { name: language.copy }))
              .toBeVisible();
            // A diagram the model gave no title or description takes the words of the page.
            await expect.soft(card).toContainText(language.title);
            await controls.first().click();
            await expect
              .soft(page.locator('[data-slot="dialog-description"]'))
              .toHaveText(language.description);
            await page.keyboard.press("Escape");

            // A diagram that cannot be drawn says so in the same words.
            const broken = await drawnRow(page, BROKEN.answer);
            const show = broken.getByRole("button", { name: language.show });
            await expect(show).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            await expect.soft(broken.getByText(language.error)).toBeVisible();
            // The code that failed stays out of sight until the reader asks for it.
            await expect.soft(broken.getByText("flowchart TD")).toBeHidden();
            await show.click();
            await expect.soft(show).toHaveAttribute("aria-expanded", "true");
            await expect.soft(broken.getByText("flowchart TD")).toBeVisible();

            // The words of a diagram that has its own are the model's, in any language.
            const titled = await drawnRow(page, TITLED.answer);
            const titledCard = titled.locator('[data-nakafa="mermaid-card"]');

            await expect(titledCard.locator('[role="img"] svg')).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            await expect.soft(titledCard).toContainText(DIAGRAM_TITLE);
            await titledCard.getByRole("button").first().click();
            await expect
              .soft(page.locator('[data-slot="dialog-description"]'))
              .toHaveText(DIAGRAM_DESCRIPTION);
          });
        })
      );
    });
  }
});
