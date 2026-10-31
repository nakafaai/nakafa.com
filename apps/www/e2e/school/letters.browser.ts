import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The editors of the first question's options, whose names carry each option's letter. */
const OPTION_OF_FIRST = /^Question 1, option /u;

/** The four options of the new question, written in Arabic: book, pen, house, door. */
const WORDS = ["كتاب", "قلم", "بيت", "باب"] as const;

/** The letters an Arabic paper names four options with, in abjad order. */
const ABJAD = ["أ", "ب", "ج", "د"] as const;

test("an Arabic option set is lettered in abjad order on the teacher's paper", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const creating = page.getByRole("dialog");
  await creating.getByRole("textbox", { name: "Exam title" }).fill("Huruf");
  await creating.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);

  // A new question's options start as a Latin set, A to D.
  const options = page.getByRole("textbox", { name: OPTION_OF_FIRST });
  await expect(options).toHaveCount(4, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(options.first()).toHaveAccessibleName("Question 1, option A");

  // Written in Arabic, the set is named as an Arabic paper names it.
  for (const [index, word] of Arr.zip(Arr.range(0, 3), WORDS)) {
    await options.nth(index).click();
    await page.keyboard.type(word);
  }
  for (const [index, letter] of Arr.zip(Arr.range(0, 3), ABJAD)) {
    await expect(options.nth(index)).toHaveAccessibleName(
      `Question 1, option ${letter}`
    );
  }
  await context.close();
});
