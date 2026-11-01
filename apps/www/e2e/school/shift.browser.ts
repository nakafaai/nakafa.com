import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

/** The key on `window` that holds the shifts of this spec. */
const SHIFTS_KEY = "nakafaPaperShifts";

/** A prompt of several lines on a phone, so a late one moves all that stands below it. */
const PROMPT =
  "Sebuah benda bergerak lurus beraturan dengan kecepatan tetap selama sepuluh detik di atas lintasan datar yang panjang, lalu berhenti. ";

/** How long the page keeps still before its shifts are read: longer than any text takes to land at this load. */
const SETTLE_MILLISECONDS = 3000;

/** How long an exam's words may take to reach the server at this load. */
const SAVED_MILLISECONDS = 60_000;

/** The screens a teacher works on: a phone, and a laptop. */
const SCREENS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
];

/** Starts a page on a cold cache at a sixth of the speed, recording every shift. */
const coldPage = async (context: BrowserContext) => {
  const page = await context.newPage();
  await page.addInitScript(recordLayoutShifts, {
    key: SHIFTS_KEY,
    overlay: "[data-sonner-toaster]",
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  return page;
};

/** Whether a text of the editor takes changes. */
const textOf = (page: Page, number: number) =>
  page.getByRole("textbox", { name: `Question ${number} text` });

/** Creates an exam of three written questions. */
const writeExam = async (page: Page, address: string) => {
  await page.goto(address);
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Fisika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  for (const number of [1, 2, 3]) {
    if (number > 1) {
      await page
        .getByRole("button", { exact: true, name: "Add question" })
        .click();
    }
    const prompt = textOf(page, number);
    await expect(prompt).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    await prompt.click();
    await page.keyboard.type(PROMPT.repeat(3));
    await expect(prompt).toContainText(PROMPT.trim());
  }
  // The words reach the server a moment after the last key, and a reload reads what it holds.
  await expect(async () => {
    await page.reload();
    await expect(textOf(page, 1)).toHaveText(PROMPT.repeat(3).trim(), {
      timeout: readinessTimeoutMilliseconds,
    });
  }).toPass({ timeout: SAVED_MILLISECONDS });
};

/** The shifts the page recorded that nothing the teacher did caused, with what each moved. */
const stillness = async (page: Page) => {
  await page.waitForTimeout(SETTLE_MILLISECONDS);
  const shifts = await Effect.runPromise(
    readRecordedLayoutShifts(page, SHIFTS_KEY)
  );
  return Arr.filter(shifts, (shift) => !shift.hadRecentInput);
};

for (const screen of SCREENS) {
  test(`the editor and the try move nothing on a cold load at ${screen.width}, at a sixth of the speed`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const setup = await browser.newContext();
    await Effect.runPromise(
      signInOwner(setup, school.slug, hostAddress(baseURL, host, "/"))
    );
    const writer = await setup.newPage();
    await writeExam(writer, hostAddress(baseURL, host, "/exams"));
    const editor = writer.url();
    await setup.close();

    const context = await browser.newContext({ viewport: screen });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await coldPage(context);

    await page.goto(editor);
    await expect(textOf(page, 1)).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await stillness(page)).toEqual([]);

    await page.getByRole("link", { name: "Try as student" }).click();
    await page.waitForURL(TRY_PATH);
    await expect(
      page.getByRole("heading", { exact: true, name: "Question 1" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText(PROMPT.trim()).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await stillness(page)).toEqual([]);
    await context.close();
  });

  test(`a student's paper moves nothing on a cold load at ${screen.width}, at a sixth of the speed`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const learner = `shift-${school.slug}@acceptance.example.test`;
    const context = await browser.newContext({ viewport: screen });
    await Effect.runPromise(
      inviteLearner({
        address: learner,
        baseURL: address("/"),
        context,
        slug: school.slug,
      })
    );
    // The seed records its exam as made by the school's Owner, who must have signed in first.
    const owner = await browser.newContext();
    await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
    await owner.close();
    const sitting = await Effect.runPromise(
      seedSitting(school.slug, learner, 0, "templates")
    );
    const page = await coldPage(context);

    await page.goto(address(`/sittings/${sitting.sittingId}`));
    const enter = page.getByRole("button", { name: "Enter sitting" });
    await waitUntilTakenOver(enter);
    await page
      .getByPlaceholder("Enter the token from your proctor")
      .fill(sitting.token);
    await enter.click();
    await expect(
      page.getByRole("heading", { exact: true, name: "Question 1" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    expect(await stillness(page)).toEqual([]);
    await context.close();
  });
}
