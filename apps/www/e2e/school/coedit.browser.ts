import { expect, type Page, test } from "@playwright/test";
import { Effect, MutableRef, Option } from "effect";
import { CONVEX_SOCKET, decodeGiven } from "@/e2e/support/frames";
import {
  createSchool,
  hostAddress,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** Word's list items as the clipboard carries them: a bullet and a number drawn as text in each paragraph. */
const WORD_LISTS = `<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><![if !supportLists]><span><span style='mso-list:Ignore'>·<span>&nbsp;</span></span></span><![endif]>butir satu</p><p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><![if !supportLists]><span><span style='mso-list:Ignore'>·<span>&nbsp;</span></span></span><![endif]>butir dua</p><p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span></span><![endif]>nomor satu</p>`;

/** The words one teacher types at the start of a prompt, one key at a time and with no pause. */
const FRONT_WORDS =
  "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh ";

/** The words the other teacher types at the end of the same prompt meanwhile. */
const BACK_WORDS =
  " sebelas dua belas tiga belas empat belas lima belas enam belas";

/** The words both teachers type between, which each teacher's caret stands on one side of. */
const MIDDLE_WORDS = "awal akhir";

/** An option of the first question. */
const option = (page: Page, letter: string) =>
  page.getByRole("textbox", { name: `Question 1, option ${letter}` });

/**
 * Counts the changes the server refused on a page, as its realtime connection answers them. A
 * concurrent edit or a fold is an answer of the editor's submit, never a refusal (ADR 0028).
 */
const countRefusals = (page: Page) => {
  const refusals = MutableRef.make(0);
  page.on("websocket", (socket) => {
    if (!CONVEX_SOCKET.test(socket.url())) {
      return;
    }
    socket.on("framereceived", ({ payload }) => {
      const frame = decodeGiven(payload.toString());
      if (
        Option.isSome(frame) &&
        frame.value.type === "MutationResponse" &&
        !frame.value.success
      ) {
        MutableRef.update(refusals, (count) => count + 1);
      }
    });
  });
  return refusals;
};

/** Creates an exam from the school's exams, and waits until its first prompt takes changes. */
const createExam = async (page: Page, address: string) => {
  await page.goto(address);
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Kimia");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });
};

test("two teachers write two options of one question while one marks the key, and every word and the key land", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const ownerContext = await browser.newContext();
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(ownerContext, school.slug, hostAddress(baseURL, host, "/"))
  );
  await Effect.runPromise(
    signInTeacher(teacherContext, school.slug, hostAddress(baseURL, host, "/"))
  );
  const owner = await ownerContext.newPage();
  await createExam(owner, hostAddress(baseURL, host, "/exams"));
  const teacher = await teacherContext.newPage();
  await teacher.goto(owner.url());
  await expect(
    teacher.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });

  await option(owner, "A").click();
  await option(teacher, "B").click();
  await Promise.all([
    owner.keyboard.type("jawaban satu"),
    teacher.keyboard.type("jawaban dua"),
  ]);
  const key = owner.getByRole("button", {
    name: "Mark option C of question 1 as correct",
  });
  await key.click();

  // Neither teacher's save overwrites the other's, and neither is told of a failure.
  for (const page of [owner, teacher]) {
    await expect(option(page, "A")).toHaveText("jawaban satu", {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(option(page, "B")).toHaveText("jawaban dua", {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  }
  await expect(key).toHaveAttribute("aria-pressed", "true");
  await teacherContext.close();
  await ownerContext.close();
});

test("two teachers type fast into one prompt at once, one at each end, and both screens and the server hold every word with no refusal", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const ownerContext = await browser.newContext();
  const teacherContext = await browser.newContext();
  await Effect.runPromise(
    signInOwner(ownerContext, school.slug, hostAddress(baseURL, host, "/"))
  );
  await Effect.runPromise(
    signInTeacher(teacherContext, school.slug, hostAddress(baseURL, host, "/"))
  );
  const owner = await ownerContext.newPage();
  const ownerRefusals = countRefusals(owner);
  await createExam(owner, hostAddress(baseURL, host, "/exams"));
  const teacher = await teacherContext.newPage();
  const teacherRefusals = countRefusals(teacher);
  await teacher.goto(owner.url());
  const ownerPrompt = owner.getByRole("textbox", { name: "Question 1 text" });
  const teacherPrompt = teacher.getByRole("textbox", {
    name: "Question 1 text",
  });
  await expect(teacherPrompt).toBeEditable({
    timeout: readinessTimeoutMilliseconds,
  });

  await ownerPrompt.click();
  await owner.keyboard.type(MIDDLE_WORDS);
  await expect(teacherPrompt).toHaveText(MIDDLE_WORDS, {
    timeout: readinessTimeoutMilliseconds,
  });
  // The owner's caret goes to the start of the words and the teacher's to their end.
  for (const _ of MIDDLE_WORDS) {
    await owner.keyboard.press("ArrowLeft");
  }
  await teacherPrompt.click();
  for (const _ of MIDDLE_WORDS) {
    await teacher.keyboard.press("ArrowRight");
  }
  // Each key is a step, so the two batches race for one version and the log folds while they do.
  await Promise.all([
    owner.keyboard.type(FRONT_WORDS),
    teacher.keyboard.type(BACK_WORDS),
  ]);

  const whole = `${FRONT_WORDS}${MIDDLE_WORDS}${BACK_WORDS}`;
  for (const page of [owner, teacher]) {
    await expect(
      page.getByRole("textbox", { name: "Question 1 text" })
    ).toHaveText(whole, { timeout: readinessTimeoutMilliseconds });
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  }
  expect(MutableRef.get(ownerRefusals)).toBe(0);
  expect(MutableRef.get(teacherRefusals)).toBe(0);

  // The server holds the same words: a fresh page opens the prompt with all of them.
  await teacher.reload();
  await expect(teacherPrompt).toHaveText(whole, {
    timeout: readinessTimeoutMilliseconds,
  });
  await teacherContext.close();
  await ownerContext.close();
});

test("a teacher adds questions and writes on at once, drags the first past the screen's end, and a list from Word stays a list", async ({
  browser,
  baseURL,
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
  await createExam(page, hostAddress(baseURL, host, "/exams"));
  const firstPrompt = page.getByRole("textbox", { name: "Question 1 text" });
  await firstPrompt.click();
  await page.keyboard.type("pertama");

  // Each added question takes the caret once its prompt opens, so the words land in it.
  for (const [number, word] of [
    [2, "kedua"],
    [3, "ketiga"],
    [4, "keempat"],
  ] as const) {
    await page
      .getByRole("button", { exact: true, name: "Add question" })
      .click();
    const prompt = page.getByRole("textbox", {
      name: `Question ${number} text`,
    });
    await expect(prompt).toBeFocused({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.keyboard.type(word);
    await expect(prompt).toHaveText(word);
  }

  // A page dragged to the canvas's edge scrolls it, so it reaches a place the screen did not show.
  await page.getByRole("button", { name: "Move question 1 down" }).focus();
  await page.evaluate(() => {
    document.querySelector("[data-grip]")?.scrollIntoView({ block: "start" });
  });
  const grip = page.locator("[data-grip]").first();
  const from = await grip.boundingBox();
  expect(from).not.toBeNull();
  const x = (from?.x ?? 0) + (from?.width ?? 0) / 2;
  await page.mouse.move(x, (from?.y ?? 0) + (from?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move(x, 500, { steps: 4 });
  await page.mouse.move(x, 840, { steps: 8 });
  await expect
    .poll(() =>
      page
        .locator("[data-page]")
        .last()
        .evaluate((last) => last.getBoundingClientRect().bottom)
    )
    .toBeLessThan(900);
  await page.mouse.up();
  await expect(
    page.getByRole("textbox", { name: "Question 4 text" })
  ).toHaveText("pertama", { timeout: readinessTimeoutMilliseconds });

  // A list pasted from Word arrives as a list, without Word's own marks.
  const prompt = page.getByRole("textbox", { name: "Question 4 text" });
  await prompt.click();
  await page.evaluate((html) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", html);
    // Firefox and WebKit drop `clipboardData` from the constructor, so the event carries it itself.
    const paste = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(paste, "clipboardData", { value: clipboardData });
    document.activeElement?.dispatchEvent(paste);
  }, WORD_LISTS);
  await expect(prompt.locator("ul li")).toHaveCount(2);
  await expect(prompt.locator("ol li")).toHaveCount(1);
  await expect(prompt).not.toContainText("·");
  await context.close();
});
