import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/;

/** The toolbar that the editor draws above the question text. */
const TOOLBAR = '[data-slot="editor-toolbar"]';

test("a teacher writes a question with headings, lists, quotes, code and a table, and the editor and the try show the same document", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));

  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Exam title" })
    .fill("PTS Matematika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  // The first question's prompt is a rich editor, with a toolbar on one line above the text.
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable();
  const toolbar = page.locator(TOOLBAR);
  await expect(toolbar).toBeVisible();

  // A word goes bold through the toolbar: a double click selects the word, and the toolbar shows
  // the bold control pressed while the caret is in it.
  await prompt.click();
  await page.keyboard.type("Luas persegi panjang");
  await prompt
    .locator("p")
    .first()
    .dblclick({ position: { x: 6, y: 6 } });
  const bold = toolbar.getByRole("button", { name: "Bold" });
  await bold.click();
  await expect(prompt.locator("strong")).toHaveText("Luas");
  await expect(bold).toHaveAttribute("aria-pressed", "true");

  // A heading comes from the slash menu, which lists the blocks under the query. The caret leaves
  // the bold word, and the control is released once the editor has read the new caret, so the
  // Enter that follows splits the paragraph after the word and not over it.
  // End left the caret in the bold word, so a press past the text places it at the end instead.
  await prompt
    .locator("p")
    .first()
    .click({ position: { x: 300, y: 6 } });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox", { name: "Insert a block" });
  await menu.getByRole("option", { name: "Heading 2" }).click();
  await page.keyboard.type("Rumus");
  await expect(prompt.locator("h2")).toHaveText("Rumus");

  // A bulleted list, and Enter on an empty item leaves it.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Bulleted list" }).click();
  await page.keyboard.type("satu");
  await page.keyboard.press("Enter");
  await page.keyboard.type("dua");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(prompt.locator("ul li")).toHaveCount(2);

  // A quote, which the quote of the toolbar's insert menu lifts back to a paragraph when it is
  // closed. The menu shows the quote checked while the caret sits in it.
  const insert = toolbar.getByRole("button", { name: "Insert a block" });
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Quote" }).click();
  await page.keyboard.type("Kutipan");
  await expect(prompt.locator("blockquote")).toHaveText("Kutipan");
  await insert.click();
  const quote = page.getByRole("menuitemcheckbox", { name: "Quote" });
  await expect(quote).toHaveAttribute("aria-checked", "true");
  await quote.click();
  await expect(prompt.locator("blockquote")).toHaveCount(0);

  // A code block takes plain text, and the code block of the toolbar's insert menu closes it.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Code block" }).click();
  await page.keyboard.type("const luas = p * l");
  await expect(prompt.locator("pre")).toHaveText("const luas = p * l");
  await insert.click();
  await page.getByRole("menuitemcheckbox", { name: "Code block" }).click();
  await expect(prompt.locator("pre")).toHaveCount(0);

  // A 2 by 2 table from the slash menu, with its header row filled through Tab.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Table" }).click();
  await page.keyboard.type("Sisi");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Nilai");
  await expect(prompt.locator("table")).toBeVisible();
  await expect(prompt.locator("tr")).toHaveCount(2);
  await expect(prompt.locator("th")).toHaveCount(2);

  // A formula comes from the slash menu, and its editor opens from the drawn formula. The LaTeX
  // tab takes x^2, and a press outside the popover closes it and saves the formula.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Formula" }).click();
  await prompt.getByRole("button", { name: "Edit formula" }).click();
  await page.getByRole("tab", { name: "LaTeX" }).click();
  await page.getByRole("textbox", { name: "LaTeX" }).fill("x^2");
  await prompt.click();
  await expect(prompt.locator('[data-formula="inline"] .katex')).toBeVisible();
  await expect(prompt.locator(".katex-error")).toHaveCount(0);

  // An image comes from the toolbar's image control. The file is a one-pixel PNG that a browser
  // decodes, and the alt text dialog asks for its alt text before the image is added to the document.
  const PIXEL_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.locator('input[type="file"]').setInputFiles({
    buffer: PIXEL_PNG,
    mimeType: "image/png",
    name: "segitiga.png",
  });
  const picture = page.getByRole("dialog");
  await picture
    .getByRole("textbox", { name: "Alt text" })
    .fill("Segitiga siku-siku");
  await picture.getByRole("button", { name: "Add image" }).click();
  await expect(prompt.locator("[data-picture] img")).toHaveAttribute(
    "alt",
    "Segitiga siku-siku",
    { timeout: readinessTimeoutMilliseconds }
  );

  // The rich text is saved by itself, so the editor opened again shows the same document.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  const reopenedPrompt = reopened.getByRole("textbox", {
    name: "Question 1 text",
  });
  await expect(reopenedPrompt.locator("strong")).toHaveText("Luas", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(reopenedPrompt.locator("h2")).toHaveText("Rumus");
  await expect(reopenedPrompt.locator("ul li")).toHaveCount(2);
  await expect(reopenedPrompt.locator("blockquote")).toHaveCount(0);
  await expect(reopenedPrompt.locator("th")).toHaveCount(2);
  await expect(
    reopenedPrompt.locator('[data-formula="inline"] .katex')
  ).toBeVisible();
  await expect(reopenedPrompt.locator("[data-picture] img")).toHaveAttribute(
    "alt",
    "Segitiga siku-siku",
    { timeout: readinessTimeoutMilliseconds }
  );

  // The try shows the same document the way a student reads it, with the formula drawn.
  await reopened.getByRole("link", { name: "Try as student" }).click();
  await reopened.waitForURL(TRY_PATH);
  await expect(reopened.getByText("Rumus")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(reopened.locator("table th")).toHaveCount(2);
  // The school's sidebar has lists of its own, outside the page's main content.
  await expect(reopened.getByRole("main").locator("ul li")).toHaveCount(2);
  await expect(
    reopened.locator('[data-formula="inline"] .katex')
  ).toBeVisible();
  await context.close();
});
