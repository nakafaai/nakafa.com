import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The toolbar that the editor draws above the question text. */
const TOOLBAR = '[data-slot="editor-toolbar"]';

/** Kitābun, "a book", as the keypad types it: kaf with fatha, ta, alif, ba with dammatan. */
const KITABUN = "كَتَابٌ";

test("a teacher writes an Arabic word with its harakat into an Indonesian question from the keypad", async ({
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
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Bahasa Arab");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("Apa arti kata ini?");
  await page.keyboard.press("Enter");

  const toolbar = page.locator(TOOLBAR);
  const keyboard = toolbar.getByRole("button", { name: "Arabic keyboard" });
  await keyboard.click();
  const keypad = page.locator('[data-slot="arabic-keypad"]');
  await expect(keypad).toBeVisible();
  // The keys draw in Amiri from their first paint: the face holds the tatweel each mark sits on and the marks.
  expect(
    await page.evaluate(() => document.fonts.check("1em Amiri", "\u0640\u064e"))
  ).toBe(true);
  await expect(keyboard).toHaveAttribute("aria-pressed", "true");

  // Each key types at the caret, and the text keeps the focus.
  for (const key of ["ك", "Fatha", "ت", "Fatha", "ا", "ب", "Dammatan"]) {
    await keypad.getByRole("button", { exact: true, name: key }).click();
  }
  await expect(prompt).toBeFocused();
  const arabic = prompt.locator("p").last();
  await expect(arabic).toHaveText(KITABUN);
  // The Arabic paragraph reads right to left in the Indonesian question.
  await expect(arabic).toHaveAttribute("dir", "auto");
  expect(
    await arabic.evaluate((element) => getComputedStyle(element).direction)
  ).toBe("rtl");
  expect(
    await prompt
      .locator("p")
      .first()
      .evaluate((element) => getComputedStyle(element).direction)
  ).toBe("ltr");

  // A press in the text moves the caret and keeps the keypad open; Escape closes it.
  await prompt.locator("p").first().click();
  await expect(keypad).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(keypad).toHaveCount(0);
  await context.close();
});
