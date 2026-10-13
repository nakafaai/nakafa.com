import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { ANSWER, answerTurn, chatOf } from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";

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
              timeout: 30_000,
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
            await expect(broken.locator("details")).toBeVisible({
              timeout: 30_000,
            });
            await expect.soft(broken.getByText(language.error)).toBeVisible();
            await expect.soft(broken.getByText(language.show)).toBeVisible();

            // The words of a diagram that has its own are the model's, in any language.
            const titled = await drawnRow(page, TITLED.answer);
            const titledCard = titled.locator('[data-nakafa="mermaid-card"]');

            await expect(titledCard.locator('[role="img"] svg')).toBeVisible({
              timeout: 30_000,
            });
            await expect
              .soft(titledCard)
              .toContainText("Alur pendaftaran siswa baru");
            await titledCard.getByRole("button").first().click();
            await expect
              .soft(page.locator('[data-slot="dialog-description"]'))
              .toHaveText("Dari pengisian formulir sampai arsip");
          });
        })
      );
    });
  }
});
