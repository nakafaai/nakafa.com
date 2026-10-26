import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/;

/** The page of the first question, whose name starts with its number. */
const FIRST_QUESTION = /^Question 1\b/;

/** The four options of the question, each with its letter and its text. B and D are correct. */
const OPTIONS = [
  { letter: "A", text: "2" },
  { letter: "B", text: "3" },
  { letter: "C", text: "4" },
  { letter: "D", text: "5" },
];

test("a teacher turns a question into complex multiple choice, marks two answers, the student picks both, and the single answer type clears the key", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Bilangan");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  const sentBefore = changes.sent;
  await prompt.click();
  await page.keyboard.type("Pilih semua bilangan prima ganjil.");
  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Question 1, option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }

  // A new question is multiple choice, named in its row, and its layer holds no rubric, since the
  // server marks a choice.
  const panel = page.getByRole("complementary", { name: "For teachers" });
  const single = page.getByRole("button", {
    name: "Question type: Multiple choice",
  });
  await expect(single).toBeVisible();
  await expect(
    panel.getByRole("textbox", { name: "Rubric of question 1" })
  ).toHaveCount(0);

  // The row's menu turns it into complex multiple choice, and the key then takes B and D together.
  await single.click();
  await page
    .getByRole("menuitemradio", { name: "Complex multiple choice" })
    .click();
  await expect(
    page.getByRole("button", { name: "Question type: Complex multiple choice" })
  ).toBeVisible();
  const keyOf = (letter: string) =>
    panel.getByRole("button", {
      name: `Mark option ${letter} of question 1 as correct`,
    });
  await keyOf("B").click();
  await keyOf("D").click();
  await expect(keyOf("B")).toHaveAttribute("aria-pressed", "true");
  await expect(keyOf("D")).toHaveAttribute("aria-pressed", "true");
  await expect(keyOf("A")).toHaveAttribute("aria-pressed", "false");
  await saved(changes, sentBefore);

  // The editor opened again shows what the server holds: the type and both marks.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  await expect(
    reopened.getByRole("button", {
      name: "Question type: Complex multiple choice",
    })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const reopenedPanel = reopened.getByRole("complementary", {
    name: "For teachers",
  });
  for (const letter of ["B", "D"]) {
    await expect(
      reopenedPanel.getByRole("button", {
        name: `Mark option ${letter} of question 1 as correct`,
      })
    ).toHaveAttribute("aria-pressed", "true");
  }

  // The student picks every option they hold correct, so the try shows check boxes and keeps both.
  await reopened.getByRole("link", { name: "Try as student" }).click();
  await reopened.waitForURL(TRY_PATH);
  for (const text of ["3", "5"]) {
    const option = reopened.getByRole("checkbox", { name: text, exact: true });
    await expect(option).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await option.click();
    await expect(option).toBeChecked();
  }
  await expect(reopened.getByRole("radio")).toHaveCount(0);
  await reopened.close();

  // Back to a single answer, the key that marked two options no longer fits, so it is cleared.
  await page
    .getByRole("button", { name: "Question type: Complex multiple choice" })
    .click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Multiple choice" })
    .click();
  await expect(single).toBeVisible();
  await expect(keyOf("B")).toHaveAttribute("aria-pressed", "false");
  await expect(keyOf("D")).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("No key yet");
  await context.close();
});
