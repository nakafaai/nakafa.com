import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The Arabic word the student types from the keypad, letter by letter: kataba, he wrote. */
const WORD = ["ك", "ت", "ب"] as const;

/** The name of the footer button that opens the question navigator on a phone. */
const OPENER = /^Open the question navigator, /u;

test("a student writes an essay with an Arabic word from the keypad and a formula from the exam editor's formula editor", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `arabic-${school.slug}@acceptance.example.test`;
  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  // The seed opens the sitting in the school's first active unit, which the school has once its Owner signed in.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  await ownerContext.close();
  const sitting = await Effect.runPromise(
    seedSitting(school.slug, learner, 0, "essay")
  );

  const student = await studentContext.newPage();
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student.getByPlaceholder("Enter the token").fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  // The navigator stands beside the paper from the large breakpoint; a phone opens it from the footer as a sheet.
  const sidebar = student.getByRole("complementary", { name: "Questions" });
  const opener = student.getByRole("button", { name: OPENER });
  await expect(sidebar.or(opener)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const phone = await opener.isVisible();
  if (phone) {
    await opener.click();
  }
  const navigator = phone
    ? student.getByRole("dialog", { name: "Questions" })
    : sidebar;
  await navigator
    .getByRole("button", { exact: true, name: "Question 3, unanswered" })
    .click();
  const question = student.getByRole("article", { name: "Question 3" });
  const essay = question.getByRole("textbox", { name: "Question 3" });
  await expect(essay).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await essay.click();

  // The keypad types each letter at the caret, and the essay keeps the focus.
  await question.getByRole("button", { name: "Arabic keyboard" }).click();
  const keypad = student.locator('[data-slot="arabic-keypad"]');
  await expect(keypad).toBeVisible();
  for (const letter of WORD) {
    await keypad.getByRole("button", { exact: true, name: letter }).click();
  }
  await expect(essay).toHaveText(Arr.join(WORD, ""));
  await expect(essay).toBeFocused();
  // A paragraph follows the direction of the words written in it.
  expect(
    await essay
      .locator("p")
      .first()
      .evaluate((paragraph) => paragraph.matches(":dir(rtl)"))
  ).toBe(true);

  // A formula opens the exam editor's formula editor at once, and stands in the essay as KaTeX draws it.
  await question.getByRole("button", { name: "Arabic keyboard" }).click();
  await expect(keypad).toBeHidden();
  await question.getByRole("button", { exact: true, name: "Formula" }).click();
  await student.getByRole("button", { exact: true, name: "LaTeX" }).click();
  await student.getByRole("textbox", { name: "LaTeX" }).fill("x^2");
  // A press outside the formula editor saves the formula.
  await question.getByRole("heading").first().click();
  await expect(
    essay.locator('[data-formula="inline"] .katex').first()
  ).toBeVisible();

  // The typed answer is the student's own: it is kept once the student leaves the field.
  await student.keyboard.press("Escape");
  await essay.blur();
  await expect(
    navigator.getByRole("button", { exact: true, name: "Question 3, answered" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});
