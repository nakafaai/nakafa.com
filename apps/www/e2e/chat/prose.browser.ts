import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { answerTurn, chatOf } from "@/e2e/support/prose";
import { openServedChat } from "@/e2e/support/serve";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** An answer with every block of a lesson's prose: headings of three levels, paragraphs and a list. */
const ANSWER = Arr.join(
  [
    "# Persamaan kuadrat",
    "",
    "Kita mulai dari bentuk umumnya.",
    "",
    "## Faktorkan",
    "",
    "Cari dua bilangan yang hasil kalinya sama dengan konstanta.",
    "",
    "### Periksa",
    "",
    "- Hasil kalinya benar.",
    "- Jumlahnya benar.",
    "",
    "Jadi kedua akarnya ketemu.",
  ],
  "\n"
);

/** What a lesson draws at its 16px base, scaled to the chat's 15px: every size and room at 15/16. */
const AT_CHAT_SIZE = (lesson: number) => `${(lesson * 15) / 16}px`;

/**
 * Nina's answer reads as a lesson reads, one size smaller: the lesson's headings, paragraphs and lists, their weight,
 * their colour and their rules, with every size and room scaled from the chat's 15px base instead of the lesson's 16px.
 */
test("draws an answer with the lesson's prose, scaled from a 15px base", async ({
  baseURL,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await runOnPage(page, baseURL, (origin) =>
    Effect.asVoid(
      openServedChat(
        page,
        origin,
        chatOf([answerTurn({ markdown: ANSWER, order: 1 })])
      )
    )
  );
  const heading = page.locator('[data-nakafa="heading-1"]').first();
  await expect(heading).toBeVisible({ timeout: readinessTimeoutMilliseconds });

  const read = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const words = element.querySelector("span") ?? element;
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          marginBottom: style.marginBottom,
          marginTop: style.marginTop,
          underline: getComputedStyle(words).textDecorationLine,
        };
      });

  const h1 = await read('[data-nakafa="heading-1"]');
  const h2 = await read('[data-nakafa="heading-2"]');
  const h3 = await read('[data-nakafa="heading-3"]');
  const paragraph = await read('[data-nakafa="paragraph"]');
  const list = await read('[data-nakafa="unordered-list"]');

  // Headings: the lesson's 30, 24 and 20 pixels, its medium weight, and the rule under the top two levels.
  expect(h1.fontSize).toBe(AT_CHAT_SIZE(30));
  expect(h2.fontSize).toBe(AT_CHAT_SIZE(24));
  expect(h3.fontSize).toBe(AT_CHAT_SIZE(20));
  expect([h1.fontWeight, h2.fontWeight, h3.fontWeight]).toEqual([
    "500",
    "500",
    "500",
  ]);
  expect(h1.underline).toContain("underline");
  expect(h2.underline).toContain("underline");
  expect(h3.underline).not.toContain("underline");
  // A heading keeps the lesson's room under it, 24 pixels at 16.
  expect(h2.marginBottom).toBe(AT_CHAT_SIZE(24));

  // Paragraphs and lists: 15px words on the lesson's relaxed lines, and the lesson's 16px room at 15/16.
  expect(paragraph.fontSize).toBe("15px");
  expect(paragraph.lineHeight).toBe(`${15 * 1.625}px`);
  expect(list.marginTop).toBe(AT_CHAT_SIZE(16));
});
