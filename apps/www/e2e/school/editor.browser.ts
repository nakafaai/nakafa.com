import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The thumbnail of the first question, whose name starts with its number. */
const FIRST_QUESTION = /^1 /;

/** The four options of the question, each with its letter and its text. The second one is correct. */
const OPTIONS = [
  { letter: "A", text: "4" },
  { letter: "B", text: "5" },
  { letter: "C", text: "6" },
  { letter: "D", text: "7" },
];

test("a teacher creates an exam, adds questions, writes one, and finds it all after a reload, with the dot on a question without a key", async ({
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

  // The dialog preselects the school's unit, whose language it shows.
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Exam title" })
    .fill("PTS Matematika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "PTS Matematika"
  );

  // A new exam starts with one question, and each added question is selected at once.
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 3" })).toBeVisible();

  // The first question gets a prompt, four options, and a correct answer.
  const strip = page.getByRole("navigation", { name: "Questions" });
  await strip.getByRole("button", { name: FIRST_QUESTION }).click();
  const prompt = page.getByRole("textbox", { name: "Question text" });
  await expect(prompt).toBeEditable();
  await prompt.click();
  await page.keyboard.type("Berapa hasil 2 + 3?");

  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }
  await page.getByRole("radio", { name: "Mark option B as correct" }).click();
  await expect(
    page.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked();

  await page.reload();
  await page.waitForLoadState("networkidle");

  // Everything the teacher wrote is there after the reload.
  await expect(
    page.getByRole("textbox", { name: "Question text" })
  ).toContainText("Berapa hasil 2 + 3?");
  for (const option of OPTIONS) {
    await expect(
      page.getByRole("textbox", { name: `Option ${option.letter}` })
    ).toHaveValue(option.text);
  }
  await expect(
    page.getByRole("radio", { name: "Mark option B as correct" })
  ).toBeChecked();

  // The two added questions have no key, so each shows its dot, and the first does not.
  await expect(
    page
      .getByRole("navigation", { name: "Questions" })
      .getByText("This question has no answer key yet.")
  ).toHaveCount(2);
  await context.close();
});
