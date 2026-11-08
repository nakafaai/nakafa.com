import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  openNewExam,
  pressTool,
  selectBack,
  TOOLBAR,
  watchFailures,
} from "@/e2e/support/toolbar";

/** The widths a teacher edits at: a phone, where the row folds its last controls under More, and a desktop. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

/** Each mark of the toolbar, the word it is pressed on, and the element the word takes. */
const MARKS = [
  { element: "strong", name: "Bold", word: "tebal" },
  { element: "em", name: "Italic", word: "miring" },
  { element: "u", name: "Underline", word: "garis" },
  { element: "code", name: "Code", word: "kode" },
  { element: "sub", name: "Subscript", word: "bawah" },
  { element: "sup", name: "Superscript", word: "atas" },
] as const;

/** A one-pixel PNG that every browser decodes, which the toolbar's image control takes. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/** A letter of the Arabic script, which the Arabic keypad types. */
const ARABIC = /[\u0600-\u06ff]/u;

/** The popover of the formula's editor. */
const FORMULA_POPOVER = '[data-slot="popover-content"]';

/** Writes `word` on a new line, selects it, and presses the mark's control; then turns the mark off at the caret. */
async function markWord(page: Page, name: string, word: string) {
  await page.keyboard.press("Enter");
  await page.keyboard.type(word);
  await selectBack(page, word.length);
  await pressTool(page, name);
  // The caret goes to the end of the word, where the mark would carry on: the same control, pressed with
  // nothing selected, turns it off for the next line.
  await page.keyboard.press("ArrowRight");
  await pressTool(page, name);
}

/** Saves the open formula with a press on the prompt's first line, far from the popover. */
async function saveFormula(page: Page, prompt: Locator) {
  await prompt.click({ position: { x: 8, y: 8 } });
  await expect(page.locator(FORMULA_POPOVER)).toHaveCount(0);
}

/** Writes `latex` in the LaTeX view of the open formula's editor. */
async function writeLatex(page: Page, latex: string) {
  await page.getByRole("button", { exact: true, name: "LaTeX" }).click();
  await page.getByRole("textbox", { name: "LaTeX" }).fill(latex);
}

for (const viewport of WIDTHS) {
  test(`at ${viewport.width}px a teacher presses every control of the exam toolbar, each does what it says, and the question reads the same after a reload, with no error`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();
    const failures = watchFailures(page);
    const prompt = await openNewExam(
      page,
      hostAddress(baseURL, host, "/exams"),
      "Uji toolbar"
    );
    await prompt.click();
    await page.keyboard.type("Soal");

    // Each mark takes the selected word, and pressed again with nothing selected, stops at the caret.
    for (const mark of MARKS) {
      await markWord(page, mark.name, mark.word);
      await expect(prompt.locator(mark.element)).toHaveText(mark.word);
    }

    // A link takes an address with no scheme as its https address, and refuses an address that is not
    // https with a sentence under the field instead of doing nothing.
    await page.keyboard.press("Enter");
    await page.keyboard.type("tautan");
    await selectBack(page, "tautan".length);
    await pressTool(page, "Link");
    const address = page.getByRole("textbox", { name: "Link" });
    await address.fill("http://nakafa.com");
    await address.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "https://" })
    ).toBeVisible();
    await address.fill("nakafa.com");
    await address.press("Enter");
    await expect(prompt.locator('a[href="https://nakafa.com"]')).toHaveText(
      "tautan"
    );
    await expect(prompt).toBeFocused();
    await page.keyboard.press("ArrowRight");

    // The text style menu turns the line into a heading, and Undo and Redo take it back and make it again.
    await page.keyboard.press("Enter");
    await page.keyboard.type("Judul");
    await pressTool(page, "Text style");
    await page.getByRole("menuitemradio", { name: "Heading 2" }).click();
    await expect(prompt.locator("h2")).toHaveText("Judul");
    await pressTool(page, "Undo");
    await expect(prompt.locator("h2")).toHaveCount(0);
    await pressTool(page, "Redo");
    await expect(prompt.locator("h2")).toHaveText("Judul");

    // The lists, the quote and the code block wrap the line and let it go again.
    await page.keyboard.press("Enter");
    await page.keyboard.type("butir");
    for (const block of [
      { element: "ul li", name: "Bulleted list" },
      { element: "ol li", name: "Numbered list" },
      { element: "blockquote", name: "Quote" },
      { element: "pre", name: "Code block" },
    ]) {
      await pressTool(page, block.name);
      await expect(prompt.locator(block.element)).toHaveText("butir");
      await pressTool(page, block.name);
      await expect(prompt.locator(block.element)).toHaveCount(0);
    }

    // An inline formula opens its editor at once. Its two views are equal segments, the formula is saved
    // by a press outside, Escape leaves it with the caret just after it, and its editor removes it.
    await page.keyboard.type(" rumus ");
    await pressTool(page, "Formula");
    const views = page
      .locator(FORMULA_POPOVER)
      .locator('[data-slot="button-group"] button');
    await expect(views).toHaveCount(2);
    const [formulaView, latexView] = await Promise.all([
      views.nth(0).boundingBox(),
      views.nth(1).boundingBox(),
    ]);
    expect(
      Math.abs((formulaView?.width ?? 0) - (latexView?.width ?? 1))
    ).toBeLessThan(1);
    await writeLatex(page, "a^2");
    await saveFormula(page, prompt);
    const inline = prompt.locator('[data-formula="inline"]');
    await expect(
      inline.locator('annotation[encoding="application/x-tex"]')
    ).toHaveText("a^2");
    await inline.getByRole("button", { name: "Edit formula" }).click();
    await expect(page.locator(FORMULA_POPOVER)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(prompt).toBeFocused();
    await page.keyboard.type("z");
    await expect(
      prompt.locator("p").filter({ has: inline }).last()
    ).toContainText("z");
    await inline.getByRole("button", { name: "Edit formula" }).click();
    await page.getByRole("button", { name: "Delete formula" }).click();
    await expect(inline).toHaveCount(0);
    await expect(prompt).toBeFocused();

    // An equation stands on a line of its own.
    await pressTool(page, "Equation");
    await writeLatex(page, "x+1");
    await saveFormula(page, prompt);
    await expect(prompt.locator('[data-formula="block"]')).toHaveCount(1);

    // An image waits for its alt text. Once selected it carries a bar above it, never over it, which edits
    // its alt text and removes it.
    await page.locator(`${TOOLBAR} input[type="file"]`).first().setInputFiles({
      buffer: PIXEL_PNG,
      mimeType: "image/png",
      name: "segitiga.png",
    });
    const added = page.getByRole("dialog");
    await added.getByRole("textbox", { name: "Alt text" }).fill("Segitiga");
    await added.getByRole("button", { name: "Add image" }).click();
    const picture = prompt.locator("[data-picture]");
    await expect(picture.locator("img")).toHaveAttribute("alt", "Segitiga", {
      timeout: readinessTimeoutMilliseconds,
    });
    await picture.click();
    const pictureBar = page.getByRole("toolbar", { name: "Segitiga" });
    await expect(pictureBar).toBeVisible();
    const [barBox, pictureBox] = await Promise.all([
      pictureBar.boundingBox(),
      picture.boundingBox(),
    ]);
    expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeLessThanOrEqual(
      (pictureBox?.y ?? 0) + 1
    );
    await pictureBar.getByRole("button", { name: "Edit alt text" }).click();
    const edit = page.getByRole("dialog");
    await edit.getByRole("textbox", { name: "Alt text" }).fill("Segitiga siku");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(picture.locator("img")).toHaveAttribute(
      "alt",
      "Segitiga siku"
    );
    await picture.click();
    await page
      .getByRole("toolbar", { name: "Segitiga siku" })
      .getByRole("button", { name: "Delete image" })
      .click();
    await expect(picture).toHaveCount(0);

    // The Arabic keypad types its letters at the caret, and the figure control opens its kinds.
    await prompt.locator("p").last().click();
    await pressTool(page, "Arabic keyboard");
    await page.locator('[data-slot="arabic-keypad"] button').first().click();
    await page.keyboard.press("Escape");
    await expect(prompt).toContainText(ARABIC);
    await pressTool(page, "Figure");
    await expect(page.getByRole("menuitem", { name: "Graph" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Everything the controls made is saved: the editor opened again reads the same question.
    await page.reload();
    const reopened = page.getByRole("textbox", { name: "Question 1 text" });
    await expect(reopened).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    for (const mark of MARKS) {
      await expect(reopened.locator(mark.element)).toHaveText(mark.word);
    }
    await expect(reopened.locator('a[href="https://nakafa.com"]')).toHaveText(
      "tautan"
    );
    await expect(reopened.locator("h2")).toHaveText("Judul");
    await expect(reopened.locator('[data-formula="block"]')).toHaveCount(1);
    await expect(reopened.locator('[data-formula="inline"]')).toHaveCount(0);
    await expect(reopened.locator("[data-picture]")).toHaveCount(0);
    await expect(reopened).toContainText(ARABIC);
    expect(MutableList.toArray(failures)).toEqual([]);
    await context.close();
  });
}
