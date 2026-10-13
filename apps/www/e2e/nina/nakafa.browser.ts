import { expect, test } from "@playwright/test";
import { Array as Arr } from "effect";
import {
  clamped,
  cutText,
  lines,
  overflow,
} from "@/e2e/support/transcript/measure";
import {
  content,
  contentBare,
  contentLong,
  failedNakafaSearch,
  quranRefs,
  searchDe,
  searchId,
  searchMany,
  searchNone,
} from "@/e2e/support/transcript/nakafa";
import { onChat, onSheet } from "@/e2e/support/transcript/open";

/**
 * The button of a result: Nakafa renders each result as a link inside a
 * button, and a link that a button renders takes the role of a button.
 */
const RESULT = "button";

test.describe("Nina lessons on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "reads two German lessons that differ in their last words",
    onChat(searchDe, { locale: "de" }, async (page) => {
      const analytical = page.getByRole(RESULT, {
        name: "mit der analytischen Methode",
      });
      const graphical = page.getByRole(RESULT, {
        name: "mit grafischer Methode",
      });
      const longest = page.getByRole(RESULT, {
        name: "Pivotisierung zerlegen",
      });
      const word = page.getByRole(RESULT, {
        name: "Wahrscheinlichkeitsmassenfunktion der Binomialverteilung",
      });

      for (const link of [analytical, graphical, longest, word]) {
        await expect(link).toBeVisible();
        // A title wraps, so nothing of it is cut sideways, and keeps to two
        // lines; these fit in two, so each shows down to its last word.
        expect(await cutText(link)).toEqual([]);
        expect(await clamped(link.locator("span").first())).toBe(false);
      }
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "reads two Indonesian lessons that differ in their last word",
    onChat(searchId, { locale: "id" }, async (page) => {
      const analytical = page.getByRole(RESULT, { name: "Metode Analitis" });
      const graphical = page.getByRole(RESULT, { name: "Metode Grafis" });

      for (const link of [analytical, graphical]) {
        await expect(link).toBeVisible();
        expect(await cutText(link)).toEqual([]);
      }
    })
  );

  test(
    "shows five results first and the rest behind one button",
    onChat(searchMany, { locale: "id" }, async (page) => {
      const results = page.getByRole(RESULT, { name: "Peluang Kejadian" });

      await expect(results).toHaveCount(5);
      await page.getByRole("button", { name: "Lebih banyak" }).click();
      await expect(results).toHaveCount(10);
      await page.getByRole("button", { name: "Lebih sedikit" }).click();
      await expect(results).toHaveCount(5);
    })
  );

  test(
    "says it when a search found nothing or failed",
    onChat(
      [...searchNone, ...failedNakafaSearch],
      { locale: "de" },
      async (page) => {
        await expect(
          page.getByText("Keine passenden Inhalte gefunden.")
        ).toBeVisible();
        await expect(
          page.getByText("Nakafa-Ergebnisse konnte nicht gelesen werden.")
        ).toBeVisible();
      }
    )
  );

  test(
    "shows a page whose title starts with a word of 33 letters in full",
    onChat(content, { locale: "de" }, async (page) => {
      const card = page.getByRole("link", {
        name: "Wahrscheinlichkeitsmassenfunktion der Binomialverteilung",
      });

      await expect(card).toBeVisible();
      expect(await cutText(card)).toEqual([]);
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "keeps the long description of a page to two lines",
    onChat(contentLong, { locale: "id" }, async (page) => {
      const description = page.getByText("Pohon penularan ideal");

      await expect(description).toBeVisible();
      expect(await lines(description)).toBeLessThanOrEqual(2);
    })
  );

  test(
    "shows a page without a description by its title alone",
    onChat(contentBare, { locale: "id" }, async (page) => {
      const card = page.getByRole("link", { name: "Sifat Vektor" });

      await expect(card).toBeVisible();
      await expect(card).toHaveText("Sifat Vektor");
    })
  );

  test(
    "reads one verse as one verse and a range as a range",
    onChat(quranRefs, { locale: "de" }, async (page) => {
      await expect(page.getByRole(RESULT, { name: "Al-Baqara" })).toHaveText(
        "Al-Baqara: 255"
      );
      await expect(
        page.getByRole(RESULT, { name: "Al-Munaafiqoon" })
      ).toHaveText("Al-Munaafiqoon: 9-11");
    })
  );
});

test.describe("Nina lessons at 200 percent zoom", () => {
  // Zoom shrinks the viewport in CSS pixels and keeps its text size: 320 pixels
  // at 200 percent are 160 CSS pixels wide.
  test.use({ viewport: { height: 2600, width: 160 } });

  test(
    "gives way in the name of a surah before it cuts a verse number",
    onChat(quranRefs, { locale: "de" }, async (page) => {
      const range = page.getByRole(RESULT, { name: "Al-Munaafiqoon" });

      await expect(range).toBeVisible();
      const cut = await cutText(range);
      // The name may end in dots, but no text that holds the verses is cut.
      expect(Arr.some(cut, (text) => text.includes("9-11"))).toBe(false);
      const box = await range.boundingBox();
      const numbers = await range.getByText(": 9-11").boundingBox();
      expect((numbers?.x ?? 0) + (numbers?.width ?? 0)).toBeLessThanOrEqual(
        (box?.x ?? 0) + (box?.width ?? 0)
      );
    })
  );
});

test.describe("Nina lessons in the sheet", () => {
  test.use({ viewport: { height: 2400, width: 1024 } });

  test(
    "reads two German lessons that differ in their last words in the compact sheet",
    onSheet(searchDe, { locale: "de" }, async (page) => {
      for (const name of [
        "mit der analytischen Methode",
        "mit grafischer Methode",
      ]) {
        const link = page.getByRole(RESULT, { name });

        await expect(link).toBeVisible();
        expect(await cutText(link)).toEqual([]);
      }
    })
  );
});
