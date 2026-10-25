import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The page of the first question, whose name starts with its number. */
const FIRST_QUESTION = /^Question 1\b/;

/** The page of the second question, whose name starts with its number. */
const SECOND_QUESTION = /^Question 2\b/;

/** The grip of the first page, which names the question by its place. */
const GRIP_OF_FIRST = "Reorder question 1";

/** The grip of the second page, which names the question by its place. */
const GRIP_OF_SECOND = "Reorder question 2";

/** Waits until the editor shows its second question, which means the exam has loaded. */
async function openExam(page: Page) {
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
}

/** The centre of a control on the page, where a pointer presses it. */
async function centreOf(control: Locator) {
  const box = await control.boundingBox();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

/** How far above the first grip the pointer ends, so the dragged page passes its middle. */
const ABOVE_THE_FIRST_GRIP = 120;

test("a teacher sets the points, writes the rubric and explanation, moves a question with the keyboard and by drag, and the editor opens with all of it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Layer");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await openExam(page);

  // Each question has its prompt, and the second one is the one the arrow keys and the drag move.
  const first = page.getByRole("region", { name: FIRST_QUESTION });
  const second = page.getByRole("region", { name: SECOND_QUESTION });
  await page.getByRole("textbox", { name: "Question 1 text" }).click();
  await page.keyboard.type("Soal pertama");
  await page.getByRole("textbox", { name: "Question 2 text" }).click();
  await page.keyboard.type("Soal kedua");
  await expect(second).toContainText("Soal kedua");

  // The teacher layer under the first paper: five points, a rubric, and an explanation.
  const points = first.getByRole("spinbutton", { name: "Points" });
  await expect(points).toHaveValue("1");
  await points.fill("5");
  await points.press("Enter");
  await expect(points).toHaveValue("5");
  await first.getByRole("textbox", { name: "Rubric of question 1" }).click();
  await page.keyboard.type("Nilai penuh untuk opsi benar.");
  await first
    .getByRole("textbox", { name: "Explanation of question 1" })
    .click();
  await page.keyboard.type("Dua tambah tiga sama dengan lima.");

  // The arrow keys move the focused grip's page one place, and the focus stays on that grip.
  await page.getByRole("button", { name: GRIP_OF_SECOND }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: GRIP_OF_FIRST })).toBeFocused();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal kedua");

  // A drag moves the page under the pointer, and the other page makes room for it. The pointer
  // ends above the first grip, so the page passes the middle of the first page whatever the heights.
  const source = await centreOf(
    page.getByRole("button", { name: GRIP_OF_SECOND })
  );
  const target = await centreOf(
    page.getByRole("button", { name: GRIP_OF_FIRST })
  );
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - ABOVE_THE_FIRST_GRIP, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal pertama");

  // Everything reaches the server, so the editor opened again shows the order and the layer.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  await openExam(reopened);
  const reopenedFirst = reopened.getByRole("region", {
    name: FIRST_QUESTION,
  });
  await expect(reopenedFirst).toContainText("Soal pertama", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    reopenedFirst.getByRole("spinbutton", { name: "Points" })
  ).toHaveValue("5");
  await expect(
    reopenedFirst.getByRole("textbox", { name: "Rubric of question 1" })
  ).toContainText("Nilai penuh untuk opsi benar.", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(
    reopenedFirst.getByRole("textbox", { name: "Explanation of question 1" })
  ).toContainText("Dua tambah tiga sama dengan lima.", {
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
