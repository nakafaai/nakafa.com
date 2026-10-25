import {
  type Browser,
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
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

/** The phone and the desktop widths that the mixed text is drawn at. */
const VIEWPORTS = [
  { name: "390", height: 844, width: 390 },
  { name: "1440", height: 900, width: 1440 },
] as const;

/**
 * The paragraphs of the seeded second question, in order. Each one reads in the direction of its own
 * words, so the Arabic paragraph starts on the right in a page that is otherwise Indonesian.
 */
const PARAGRAPHS = [
  { direction: "ltr", text: "Soal kedua: baca teks berikut dengan cermat." },
  { direction: "rtl", text: "مرحبا بكم في الامتحان، اقرأ النص بعناية." },
  { direction: "ltr", text: "Read the passage and answer the question below." },
] as const;

/** A sample of Arabic that only the Amiri face draws, which the check below asks the browser about. */
const ARABIC_SAMPLE = "مرحبا";

/**
 * Each paragraph of a prompt carries `dir="auto"`, and the browser computes the direction of its own
 * words, so the Arabic paragraph is right to left and the others are left to right.
 */
async function expectParagraphsInTheirDirection(prompt: Locator) {
  const paragraphs = prompt.locator("p");
  await expect(paragraphs).toHaveCount(PARAGRAPHS.length);
  for (const [index, paragraph] of Arr.map(
    PARAGRAPHS,
    (item, position) => [position, item] as const
  )) {
    const block = paragraphs.nth(index);
    await expect(block).toHaveAttribute("dir", "auto");
    await expect(block).toHaveText(paragraph.text);
    await expect
      .poll(() => block.evaluate((node) => getComputedStyle(node).direction))
      .toBe(paragraph.direction);
  }
}

/** Whether the browser holds a loaded Amiri face that draws the Arabic sample. */
function amiriDrawsArabic(page: Page) {
  return page.evaluate(
    (sample) =>
      document.fonts.check(`16px "Amiri"`, sample) &&
      Array.from(document.fonts).some(
        (face) => face.family.includes("Amiri") && face.status === "loaded"
      ),
    ARABIC_SAMPLE
  );
}

/** Whether the page is as wide as its viewport, so no part of it needs a sideways scroll. */
function fitsTheViewport(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth
  );
}

/**
 * One school with an exam whose second question mixes three languages, read in the editor and in the
 * student's sitting at one viewport, plus the school's home, which shows no Arabic.
 */
async function expectMixedQuestionAt(
  browser: Browser,
  baseURL: string | undefined,
  viewport: (typeof VIEWPORTS)[number],
  testInfo: TestInfo
) {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const address = (path: string) => hostAddress(baseURL, host, path);
  const learner = `student-${school.slug}@acceptance.example.test`;

  const studentContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: studentContext,
      slug: school.slug,
    })
  );
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  // The editor: the owner opens the exam, and reads the second question's prompt in place.
  const owner = await ownerContext.newPage();
  await owner.setViewportSize(viewport);
  await owner.goto(address(`/exams/${sitting.examId}/edit`));
  const editorPrompt = owner.getByRole("textbox", { name: "Question 2 text" });
  await expect(editorPrompt).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expectParagraphsInTheirDirection(editorPrompt);
  await expect
    .poll(() => amiriDrawsArabic(owner), {
      timeout: readinessTimeoutMilliseconds,
    })
    .toBe(true);
  expect(await fitsTheViewport(owner)).toBe(true);
  await owner.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`multilingual-editor-${viewport.name}.png`),
  });

  // The student's sitting: the learner enters with the token and reads the same question.
  const student = await studentContext.newPage();
  await student.setViewportSize(viewport);
  await student.goto(address(`/sittings/${sitting.sittingId}`));
  await waitUntilTakenOver(
    student.getByRole("button", { name: "Enter sitting" })
  );
  await student
    .getByPlaceholder("Enter the token from your proctor")
    .fill(sitting.token);
  await student.getByRole("button", { name: "Enter sitting" }).click();
  await expect(
    student.getByRole("heading", { name: "Question 2" })
  ).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const studentPrompt = student
    .getByRole("textbox", { name: "Question text" })
    .nth(1);
  await expectParagraphsInTheirDirection(studentPrompt);
  await expect
    .poll(() => amiriDrawsArabic(student), {
      timeout: readinessTimeoutMilliseconds,
    })
    .toBe(true);
  expect(await fitsTheViewport(student)).toBe(true);
  await student.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`multilingual-student-${viewport.name}.png`),
  });

  // A page that shows no Arabic loads no Amiri face: the school's home has only Latin text.
  const home = await ownerContext.newPage();
  await home.setViewportSize(viewport);
  await home.goto(address("/"));
  await expect(home.locator('[data-sidebar="sidebar"]:visible')).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const amiriLoaded = await home.evaluate(
    () =>
      Array.from(document.fonts).filter(
        (face) => face.family.includes("Amiri") && face.status === "loaded"
      ).length
  );
  expect(amiriLoaded).toBe(0);
  await Promise.all([studentContext.close(), ownerContext.close()]);
}

for (const viewport of VIEWPORTS) {
  test(`a question that mixes Indonesian, Arabic and English reads in each paragraph's direction at ${viewport.name} px, in the editor and the student's sitting`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    await expectMixedQuestionAt(browser, baseURL, viewport, testInfo);
  });
}
