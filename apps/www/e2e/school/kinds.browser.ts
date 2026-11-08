import { expect, type Locator, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  openNewExam,
  pressTool,
  selectBack,
  watchFailures,
} from "@/e2e/support/toolbar";

/** Every kind of question, by the name its type menu gives it. */
const KINDS = [
  "Multiple choice",
  "Complex multiple choice",
  "True or false",
  "Cause and effect",
  "Short answer",
  "Numeric answer",
  "Essay",
  "Matching",
  "True or false table",
  "Answer and reason",
] as const;

/** The menu of a question's type, by the start of its name. */
const QUESTION_TYPE = /^Question type: /u;

/** The word each text of a question takes, which the toolbar's bold control marks. */
const WORD = "uji";

/** How far a marker's middle may stand from the middle of its words' first line, in pixels. */
const MARK_TOLERANCE = 2;

/**
 * How far each marker of a part's row, its letter, circle, dot or remove control, stands from the middle of the first
 * line of the part's words, in whole pixels. A text outside a marked line, such as the prompt, has none.
 */
function markOffsets(text: Locator) {
  return text.evaluate((element) => {
    const row = element.closest('[data-slot="line-words"]')?.parentElement;
    const first = element.firstElementChild;
    if (row === null || row === undefined || first === null) {
      return [];
    }
    const range = document.createRange();
    range.selectNodeContents(first);
    const line = range.getClientRects()[0] ?? first.getBoundingClientRect();
    const middle = line.top + line.height / 2;
    return Array.from(
      row.querySelectorAll(':scope > [data-slot="line-mark"]'),
      (mark) => {
        const box = mark.getBoundingClientRect();
        return Math.round(box.top + box.height / 2 - middle);
      }
    );
  });
}

test("in every kind of question, each text of the question takes the toolbar's marks and tables, and a table left empty goes with Backspace", async ({
  baseURL,
  browser,
}) => {
  test.slow();
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  const failures = watchFailures(page);
  await openNewExam(page, hostAddress(baseURL, host, "/exams"), "Uji jenis");
  // The texts of the first question: its prompt, its options, statements and reasons, and its explanation.
  const texts = page.locator('.ProseMirror[aria-label*="question 1" i]');

  for (const kind of KINDS) {
    await page.getByRole("button", { name: QUESTION_TYPE }).first().click();
    await page.getByRole("menuitemradio", { exact: true, name: kind }).click();
    await expect(
      page.getByRole("button", { name: `Question type: ${kind}` })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(texts.first()).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });

    const count = await texts.count();
    expect(count, `${kind} has its texts`).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const text = texts.nth(index);
      const name = await text.getAttribute("aria-label");
      // A press at the text's bottom end puts the caret after its last words.
      const box = await text.boundingBox();
      await text.click({
        position: {
          x: Math.max((box?.width ?? 8) - 4, 1),
          y: Math.max((box?.height ?? 8) - 4, 1),
        },
      });
      await expect(text, `${kind}: ${name} takes the focus`).toBeFocused();
      await page.keyboard.type(` ${WORD}`);
      await expect(text).toContainText(WORD);
      await expect(
        text,
        `${kind}: ${name} keeps the focus while the teacher types`
      ).toBeFocused();
      await selectBack(page, WORD.length);
      await pressTool(page, "Bold");
      await expect(
        text.locator("strong").last(),
        `${kind}: ${name} takes bold`
      ).toHaveText(WORD);
      await page.keyboard.press("ArrowRight");
      await pressTool(page, "Bold");
      await pressTool(page, "Table");
      await expect(
        text.locator("table"),
        `${kind}: ${name} takes a table`
      ).toHaveCount(1);
      // A part that holds its words and a table under them keeps its markers on the words' first line.
      expect
        .soft(
          (await markOffsets(text)).filter(
            (offset) => Math.abs(offset) > MARK_TOLERANCE
          ),
          `${kind}: ${name} keeps its markers on its first line over a table`
        )
        .toEqual([]);
      await page.keyboard.press("Backspace");
      await expect(
        text.locator("table"),
        `${kind}: ${name} drops an empty table on Backspace`
      ).toHaveCount(0);
    }
  }
  expect(MutableList.toArray(failures)).toEqual([]);
  await context.close();
});
