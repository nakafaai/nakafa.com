// Takes the pictures of the school exam editor at 390 px and 1440 px in both
// themes: the exams list, the create dialog, a new exam, and a written question
// with its options and key. Copy it to apps/www/e2e/school/zshots.browser.ts of
// that worktree (never commit it).
import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

const SHOTS = process.env.SHOTS_DIR ?? "";
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;
const OPTIONS = [
  { letter: "A", text: "4" },
  { letter: "B", text: "5" },
  { letter: "C", text: "6" },
  { letter: "D", text: "7" },
];

async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ fullPage: false, path: `${SHOTS}/${name}.png` });
}

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`exam editor at ${width} in ${theme}`, async ({ browser, baseURL }) => {
      test.setTimeout(300_000);
      const tag = `${width}-${theme}`;
      const school = await Effect.runPromise(createSchool());
      const host = `${school.slug}.localhost`;
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { height: 900, width },
      });
      await Effect.runPromise(
        signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
      );
      const page = await context.newPage();
      await page.goto(hostAddress(baseURL, host, "/exams"));
      const create = page.getByRole("button", { name: "Create exam" });
      await expect(create).toBeVisible({ timeout: 30_000 });
      await shoot(page, `${tag}-01-list`);

      await create.click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("textbox", { name: "Exam title" })
        .fill("PTS Matematika");
      await shoot(page, `${tag}-02-create`);
      await dialog.getByRole("button", { name: "Create exam" }).click();
      await page.waitForURL(EDITOR_PATH);
      await expect(
        page.getByRole("textbox", { name: "Question text" })
      ).toBeEditable();
      await shoot(page, `${tag}-03-new-exam`);

      const prompt = page.getByRole("textbox", { name: "Question text" });
      await prompt.click();
      await page.keyboard.type("Berapa hasil 2 + 3?");
      for (const option of OPTIONS) {
        const field = page.getByRole("textbox", {
          name: `Option ${option.letter}`,
        });
        await field.fill(option.text);
        await field.press("Tab");
      }
      await page
        .getByRole("radio", { name: "Mark option B as correct" })
        .click();
      await page.getByRole("button", { name: "Add question" }).click();
      await expect(
        page.getByRole("heading", { name: "Question 2" })
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "Questions" })
        .getByRole("button", { name: /^1 / })
        .click();
      await shoot(page, `${tag}-04-written-question`);
      await context.close();
    });
  }
}
