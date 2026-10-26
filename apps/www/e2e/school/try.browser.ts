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

/** The editor's leave of its room, which it sends as the try replaces it, and may land after the try opens. */
const LEAVE = "exams/presence:leave";

/** The prompt that the teacher writes, which the try shows the way a student reads it. */
const PROMPT = "Berapa hasil 2 + 3?";

/** The four options of the question, each with its letter and its text. The second one is correct. */
const OPTIONS = [
  { letter: "A", text: "4" },
  { letter: "B", text: "5" },
  { letter: "C", text: "6" },
  { letter: "D", text: "7" },
];

test("a teacher tries an exam as a student, picks an answer, and the answer is never sent", async ({
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
  const ownerChanges = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));

  // The exam starts with one question, which the editor selects, and the teacher writes it.
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Biologi");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable();
  const sentBefore = ownerChanges.sent;
  await prompt.click();
  await page.keyboard.type(PROMPT);
  for (const option of OPTIONS) {
    const field = page.getByRole("textbox", {
      name: `Question 1, option ${option.letter}`,
    });
    await field.fill(option.text);
    await field.press("Tab");
  }
  await page
    .getByRole("button", { name: "Mark option B of question 1 as correct" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark option B of question 1 as correct" })
  ).toHaveAttribute("aria-pressed", "true");

  // The page shows a change before the server holds it, so the try page opens once the server has
  // the prompt, the options and the key that it reads.
  await saved(ownerChanges, sentBefore);

  // The try page is tracked from its first load. The editor opened there holds what the server
  // holds, so the prompt and the options it shows are the ones the try reads.
  const trying = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(trying, []));
  await trying.goto(page.url());
  await expect(
    trying.getByRole("textbox", { name: "Question 1 text" })
  ).toContainText(PROMPT, { timeout: readinessTimeoutMilliseconds });

  // The try action sits beside Schedule in the editor's header, and opens the try.
  await trying.getByRole("button", { name: "Try as student" }).click();
  await trying.waitForURL(TRY_PATH);
  // Every change the page sent but the editor's leave of its room, which is no answer of the try.
  const sentByTry = () => changes.sent - changes.argumentsOf(LEAVE).length;
  const sentOnEntering = sentByTry();
  await expect(trying.getByRole("heading", { name: "Question 1" })).toBeVisible(
    { timeout: readinessTimeoutMilliseconds }
  );
  await expect(trying.getByText("Answers here are not saved.")).toBeVisible();
  await expect(trying.getByText(PROMPT)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  // The try names each option by the question's answer label, so an option is found by its text.
  for (const option of OPTIONS) {
    await expect(
      trying.getByRole("radio", { name: option.text, exact: true })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  }

  // The student's choice is kept in the page, and the server gets no change for it.
  await trying.getByRole("radio", { name: "5", exact: true }).click();
  await expect(
    trying.getByRole("radio", { name: "5", exact: true })
  ).toBeChecked();
  expect(sentByTry()).toBe(sentOnEntering);

  // Finish trying returns to the editor, and the try sent nothing before the page was left.
  await trying.getByRole("link", { name: "Finish trying" }).click();
  await trying.waitForURL(EDITOR_PATH);
  await expect(trying.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "PTS Biologi"
  );
  await context.close();
});
