import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/;

/** The first question's thumbnail, whose name starts with its number. */
const FIRST_QUESTION = /^Question 1\b/;

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
  const strip = page.getByRole("navigation", { name: "Questions" });
  await strip.getByRole("button", { name: FIRST_QUESTION }).click();
  const prompt = page.getByRole("textbox", { name: "Question text" });
  await expect(prompt).toBeEditable();
  const toolbar = page.locator(TOOLBAR);
  await expect(toolbar).toBeVisible();

  // A word goes bold through the toolbar, with the selection kept in the text.
  await prompt.click();
  await page.keyboard.type("Luas persegi panjang");
  await page.keyboard.press("Home");
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press("Shift+ArrowRight");
  }
  await toolbar.getByRole("button", { name: "Bold" }).click();
  await expect(prompt.locator("strong")).toHaveText("Luas");

  // A heading comes from the slash menu, which lists the blocks under the query.
  await page.keyboard.press("End");
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

  // A quote, which the toolbar's quote control lifts back to a paragraph when it is closed.
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Quote" }).click();
  await page.keyboard.type("Kutipan");
  await expect(prompt.locator("blockquote")).toHaveText("Kutipan");
  await toolbar.getByRole("button", { name: "Quote" }).click();
  await expect(prompt.locator("blockquote")).toHaveCount(0);

  // A code block takes plain text, and the toolbar's code block control closes it.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await menu.getByRole("option", { name: "Code block" }).click();
  await page.keyboard.type("const luas = p * l");
  await expect(prompt.locator("pre")).toHaveText("const luas = p * l");
  await toolbar.getByRole("button", { name: "Code block" }).click();
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

  // An image comes from the toolbar's image control. The file is a one-pixel PNG, and the alt text
  // dialog asks for its alt text before the image is added to the document.
  const PIXEL_PNG = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
      "1f15c4890000000d49444154789c63f8cfc0f01f0005000201a5f6c4c10000000049454e44ae426082",
    "hex"
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
    name: "Question text",
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
  await expect(reopened.locator("ul li")).toHaveCount(2);
  await expect(
    reopened.locator('[data-formula="inline"] .katex')
  ).toBeVisible();
  await context.close();
});
