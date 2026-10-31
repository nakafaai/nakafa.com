import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

/** The page of the first question, whose name starts with its number. */
const FIRST_QUESTION = /^Question 1\b/u;

test("a teacher turns a question into a numeric answer, keys its number with a tolerance, a fraction and a unit, and the student types a fraction", async ({
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
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Setengah");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("Berapa setengah kilogram dalam kilogram?");

  // A numeric answer holds no options: the paper shows the student's number field instead.
  await page
    .getByRole("button", { name: "Question type: Multiple choice" })
    .click();
  await page.getByRole("menuitemradio", { name: "Numeric answer" }).click();
  await expect(
    page.getByRole("textbox", { name: "Question 1, option A" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Number field" })
  ).toBeVisible();

  // The layer keeps a slip in its field with the reason, and saves the number the contract grades.
  const panel = page.getByRole("complementary", { name: "For teachers" });
  const value = panel.getByRole("textbox", {
    name: "Correct number of question 1",
  });
  const sentBefore = changes.sent;
  await value.fill("setengah");
  await value.press("Enter");
  await expect(
    panel.getByText("Type a number, such as 0.75 or 12.")
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("No key yet");
  await value.fill("0,5");
  await value.press("Enter");
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).not.toContainText("No key yet");
  await panel
    .getByRole("combobox", { name: "Tolerance of question 1" })
    .click();
  await page.getByRole("option", { name: "Within a distance" }).click();
  const within = panel.getByRole("textbox", {
    name: "Tolerance amount of question 1",
  });
  await within.fill("0,01");
  await within.press("Enter");
  await panel
    .getByRole("checkbox", { name: "Accept a fraction, such as 3/4" })
    .click();
  const unit = panel.getByRole("textbox", { name: "Unit" });
  await unit.fill("kg");
  await unit.press("Enter");
  await saved(changes, sentBefore);

  // The editor opened again shows the key the server holds, spelled as the contract stores it.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  const reopenedPanel = reopened.getByRole("complementary", {
    name: "For teachers",
  });
  await expect(
    reopenedPanel.getByRole("textbox", {
      name: "Correct number of question 1",
    })
  ).toHaveValue("0.5", { timeout: readinessTimeoutMilliseconds });
  await expect(
    reopenedPanel.getByRole("textbox", {
      name: "Tolerance amount of question 1",
    })
  ).toHaveValue("0.01");
  await expect(
    reopenedPanel.getByRole("checkbox", {
      name: "Accept a fraction, such as 3/4",
    })
  ).toBeChecked();
  await expect(
    reopenedPanel.getByRole("textbox", { name: "Unit" })
  ).toHaveValue("kg");

  // The student types a fraction into one field beside its unit, and no option shows.
  await reopened.getByRole("link", { name: "Try as student" }).click();
  await reopened.waitForURL(TRY_PATH);
  const field = reopened.getByRole("textbox", {
    exact: true,
    name: "Question 1",
  });
  await expect(field).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(field).toHaveAttribute("inputmode", "decimal");
  await expect(reopened.getByText("kg", { exact: true })).toBeVisible();
  await field.fill("1/2");
  await expect(field).toHaveValue("1/2");
  await expect(reopened.getByRole("radio")).toHaveCount(0);
  await context.close();
});
