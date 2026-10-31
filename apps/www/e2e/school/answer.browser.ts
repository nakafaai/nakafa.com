import { expect, test } from "@playwright/test";
import { Effect } from "effect";
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

test("a student writes an Arabic answer from the sitting's Arabic keypad, and the field reads right to left", async ({
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
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  const navigator = student.getByRole("complementary", { name: "Questions" });
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
  await expect(essay).toHaveValue(WORD.join(""));
  await expect(essay).toBeFocused();
  // The field follows the direction of the words written in it.
  await expect(essay).toHaveAttribute("dir", "auto");
  expect(await essay.evaluate((field) => field.matches(":dir(rtl)"))).toBe(
    true
  );

  // The typed answer is the student's own: it is kept once the student leaves the field.
  await student.keyboard.press("Escape");
  await essay.blur();
  await expect(
    navigator.getByRole("button", { exact: true, name: "Question 3, answered" })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await studentContext.close();
});
