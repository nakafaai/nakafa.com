import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  ANSWER,
  answerTurn,
  chatOf,
  DIAGRAM_DESCRIPTION,
  DIAGRAM_TITLE,
} from "@/e2e/support/prose";
import { settled } from "@/e2e/support/rows";
import { drawnRow, openServedChat } from "@/e2e/support/serve";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

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
    zoomIn: "Vergrößern",
    zoomOut: "Verkleinern",
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
    zoomIn: "Perbesar",
    zoomOut: "Perkecil",
  },
];

/** Mermaid writes its labels at 16 pixels; a diagram is never drawn below three quarters of that. */
const LABEL_PIXELS = 16;
const LEGIBLE_PIXELS = 12;

/**
 * How a box draws its diagram: the size a label reaches on the page, which is
 * its own font size times the drawing's scale, and whether the box scrolls.
 */
const drawnFacts = (box: Element) => {
  const svg = box.querySelector("svg");
  const label = svg?.querySelector(".nodeLabel");
  const fontPixels = label
    ? Number.parseFloat(getComputedStyle(label).fontSize)
    : Number.NaN;

  return {
    labelPixels: fontPixels * (svg?.getScreenCTM()?.a ?? Number.NaN),
    scrolls:
      box.scrollWidth > box.clientWidth + 1 ||
      box.scrollHeight > box.clientHeight + 1,
  };
};

/** Every element of the dialog that scrolls, named by its role or its tag. */
const dialogScrollers = (dialog: Element) =>
  Array.from(dialog.querySelectorAll("*"))
    .filter((element) => {
      const style = getComputedStyle(element);
      return (
        (["auto", "scroll"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 1) ||
        (["auto", "scroll"].includes(style.overflowX) &&
          element.scrollWidth > element.clientWidth + 1)
      );
    })
    .map((element) => element.getAttribute("role") ?? element.tagName);

test.describe("The dialog of a diagram", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const width of [390, 768, 1440]) {
    test(`at ${width}px keeps every label legible and scrolls in one place`, async ({
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
            // The card fits the diagram, never below a 12 pixel label, and
            // scrolls only when the diagram is larger than that.
            const preview = await wrapper.evaluate(drawnFacts);
            expect
              .soft(preview.labelPixels)
              .toBeGreaterThanOrEqual(LEGIBLE_PIXELS - 0.1);
            expect
              .soft(preview.labelPixels)
              .toBeLessThanOrEqual(LABEL_PIXELS + 0.1);
            expect
              .soft(
                preview.scrolls && preview.labelPixels > LEGIBLE_PIXELS + 0.1
              )
              .toBe(false);

            await card.getByRole("button").first().click();
            const dialog = page.getByRole("dialog");
            const box = dialog.getByRole("img", { name: DIAGRAM_TITLE });
            await expect(box.locator("svg")).toBeVisible({
              timeout: revealTimeoutMilliseconds,
            });
            // The dialog zooms in when it opens, and a drawing measured during the zoom is scaled.
            await settled(box);
            const fitted = await box.evaluate(drawnFacts);
            expect
              .soft(fitted.labelPixels)
              .toBeGreaterThanOrEqual(LEGIBLE_PIXELS - 0.1);
            expect
              .soft(fitted.labelPixels)
              .toBeLessThanOrEqual(LABEL_PIXELS + 0.1);
            // The dialog's body never scrolls: the diagram's box is the one place that does.
            const scrollers = await dialog.evaluate(dialogScrollers);
            expect.soft(scrollers).toEqual(fitted.scrolls ? ["img"] : []);

            // Zoomed to twice its natural size, it pans in its own box.
            const zoomIn = dialog.getByRole("button", { name: "Zoom in" });
            await zoomIn.click();
            await zoomIn.click();
            await zoomIn.click();
            await expect.soft(zoomIn).toBeDisabled();
            const zoomed = await box.evaluate(drawnFacts);
            expect
              .soft(Math.abs(zoomed.labelPixels - 2 * LABEL_PIXELS))
              .toBeLessThanOrEqual(0.5);
            expect.soft(zoomed.scrolls).toBe(true);
            expect
              .soft(await dialog.evaluate(dialogScrollers))
              .toEqual(["img"]);
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
            // A phone opens the diagram as a drawer, so the open dialog's own description is read.
            await expect
              .soft(page.getByRole("dialog"))
              .toHaveAccessibleDescription(language.description);
            // Its zoom has a name in the page's language too.
            await expect
              .soft(page.getByRole("button", { name: language.zoomIn }))
              .toBeVisible();
            await expect
              .soft(page.getByRole("button", { name: language.zoomOut }))
              .toBeVisible();
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
              .soft(page.getByRole("dialog"))
              .toHaveAccessibleDescription(DIAGRAM_DESCRIPTION);
          });
        })
      );
    });
  }
});
