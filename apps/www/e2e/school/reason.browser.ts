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

test("a teacher writes an answer and its reason, marks both keys one at a time, and the student answers both in one question", async ({
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
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Beralasan");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("Mengapa air memuai saat dipanaskan?");

  // The paper gains the reasons under their name, and the options written so far stay.
  await page
    .getByRole("textbox", { name: "Question 1, option A" })
    .fill("Benar");
  await page
    .getByRole("button", { name: "Question type: Multiple choice" })
    .click();
  await page.getByRole("menuitemradio", { name: "Answer and reason" }).click();
  await expect(
    page.getByRole("textbox", { name: "Question 1, option A" })
  ).toHaveText("Benar");
  const panel = page.getByRole("complementary", { name: "For teachers" });
  await expect(panel.getByRole("spinbutton")).toHaveValue("2");
  await page
    .getByRole("textbox", { name: "Question 1, option B" })
    .fill("Salah");
  await page
    .getByRole("textbox", { name: "Question 1, reason A" })
    .fill("Partikelnya bergerak lebih cepat");
  await page
    .getByRole("textbox", { name: "Question 1, reason B" })
    .fill("Massanya bertambah");
  await page
    .getByRole("textbox", { name: "Question 1, reason C" })
    .fill("Warnanya berubah");

  // Each key is marked on its own, so the first mark saves before the second is given.
  const sentBefore = changes.sent;
  await panel
    .getByRole("button", { name: "Mark option A of question 1 as correct" })
    .click();
  await saved(changes, sentBefore);
  await panel
    .getByRole("button", { name: "Mark reason A of question 1 as correct" })
    .click();
  await saved(changes, sentBefore);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

  // The student picks one answer and one reason, and picking again moves only its own.
  await page.getByRole("link", { name: "Try as student" }).click();
  await page.waitForURL(TRY_PATH);
  const answers = page.getByRole("radiogroup", { name: "Answer" });
  const reasons = page.getByRole("radiogroup", { name: "Reason" });
  await expect(answers).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await answers.getByRole("radio", { name: "Benar" }).click();
  await reasons.getByRole("radio", { name: "Massanya bertambah" }).click();
  await reasons.getByRole("radio", { name: "Warnanya berubah" }).click();
  await expect(answers.getByRole("radio", { name: "Benar" })).toBeChecked();
  await expect(
    reasons.getByRole("radio", { name: "Warnanya berubah" })
  ).toBeChecked();
  await expect(
    reasons.getByRole("radio", { name: "Massanya bertambah" })
  ).not.toBeChecked();
  await context.close();
});
