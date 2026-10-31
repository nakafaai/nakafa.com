import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, String as Str } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { expectNoOverflow } from "@/e2e/support/layout";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The editor of one exam. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The end of the editor's path, which the try's path takes in place of it. */
const EDIT_SUFFIX = /\/edit$/u;

/** The first question's region on the canvas. */
const FIRST_QUESTION = /^Question 1\b/u;

/** Every remove button of the first question's options. */
const REMOVE_OPTION = /^Remove option [A-Z] of question 1$/u;

/** An option of 300 characters in Arabic, a sentence a student reads right to left. */
const ARABIC_OPTION = Str.slice(
  0,
  300
)(
  Arr.join(
    Arr.makeBy(10, () => "يقرأ الطالب الكتاب في المكتبة كل صباح"),
    " "
  )
);

/** The phone and the desktop widths the try is read at. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1302 },
] as const;

/** The option field of the first question that `letter` names. */
const optionField = (page: Page, letter: string) =>
  page.getByRole("textbox", { name: `Question 1, option ${letter}` });

/**
 * Opens the student's try of the exam at each width, and asserts that it shows exactly the options with
 * words, never a sideways scroll, and attaches a picture of each width.
 */
async function expectTry(page: Page, editor: string, options: string[]) {
  await page.goto(editor.replace(EDIT_SUFFIX, "/try"));
  for (const size of WIDTHS) {
    await page.setViewportSize(size);
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(options.length, {
      timeout: readinessTimeoutMilliseconds,
    });
    for (const text of options) {
      await expect(
        page.getByRole("radio", { exact: true, name: text })
      ).toBeVisible();
    }
    await Effect.runPromise(expectNoOverflow(page, `try ${size.width}`));
    await test.info().attach(`try-${options.length}-${size.width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }
}

test("a teacher's empty options never reach a student, the schedule names them, and a choice keeps two to five options, the longest in Arabic too", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(240_000);
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1302 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const creating = page.getByRole("dialog");
  await creating
    .getByRole("textbox", { name: "Exam title" })
    .fill("Uji coba opsi");
  await creating.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const editor = page.url();
  const question = page.getByRole("region", { name: FIRST_QUESTION });

  // The teacher writes two of the four options and marks the first, leaving C and D as they started.
  const sentBefore = changes.sent;
  await expect(optionField(page, "A")).toBeEditable({
    timeout: readinessTimeoutMilliseconds,
  });
  await optionField(page, "A").fill("144");
  await optionField(page, "A").press("Tab");
  await optionField(page, "B").fill("124");
  await optionField(page, "B").press("Tab");
  await page
    .getByRole("complementary", { name: "For teachers" })
    .getByRole("button", { name: "Mark option A of question 1 as correct" })
    .click();
  await saved(changes, sentBefore);
  await expect(question).toContainText("Empty option");
  await expect(question).not.toContainText("No key yet");

  // The schedule names the empty options before the teacher asks, and its submit stays off.
  await page.getByRole("button", { name: "Schedule" }).click();
  const scheduling = page.getByRole("dialog");
  await expect(
    scheduling.getByText(
      "Write every option of question 1, or remove the empty ones."
    )
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    scheduling.getByRole("button", { exact: true, name: "Schedule" })
  ).toBeDisabled();
  await test.info().attach("schedule-empty", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await scheduling.getByRole("button", { name: "Cancel" }).click();

  // The student's paper holds the two written options and nothing for C and D.
  const trying = await context.newPage();
  await expectTry(trying, editor, ["144", "124"]);

  // A choice holds five options at most: the fifth takes the last place, and no add follows it.
  await optionField(page, "A").click();
  await page.getByRole("button", { exact: true, name: "Add option" }).click();
  await expect(optionField(page, "E")).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Add option" })
  ).toHaveCount(0);

  // Removing the three empty options leaves the two written ones, which a choice keeps at least.
  for (const _ of Arr.range(1, 3)) {
    await page
      .getByRole("button", { name: "Remove option C of question 1" })
      .click();
  }
  await expect(optionField(page, "C")).toHaveCount(0);
  await expect(
    question.getByRole("button", { name: REMOVE_OPTION })
  ).toHaveCount(0);
  await expect(question).not.toContainText("Empty option");

  // A third option of 300 Arabic characters wraps inside the paper at the phone width, read right to left.
  await optionField(page, "A").click();
  await page.getByRole("button", { exact: true, name: "Add option" }).click();
  const sentArabic = changes.sent;
  await optionField(page, "C").fill(ARABIC_OPTION);
  await optionField(page, "C").press("Tab");
  await saved(changes, sentArabic);
  await expect(question).not.toContainText("Empty option");
  await expectTry(trying, editor, ["144", "124", ARABIC_OPTION]);
  expect(
    await trying
      .getByText(ARABIC_OPTION, { exact: true })
      .evaluate((element) => getComputedStyle(element).direction)
  ).toBe("rtl");
  await context.close();
});
