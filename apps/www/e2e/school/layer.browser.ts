import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

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

/** A desktop window tall enough to show both questions' grips, so the drag presses grips the teacher can see. */
const DESKTOP = { height: 900, width: 1440 };

test("a teacher sets the points, the key and the explanation, moves a question with the keyboard and by drag, and the editor opens with all of it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({ viewport: DESKTOP });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Layer");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await openExam(page);

  // Each question has its prompt, and the second one is the one the arrow keys and the drag move.
  const second = page.getByRole("region", { name: SECOND_QUESTION });
  const firstText = page.getByRole("textbox", { name: "Question 1 text" });
  const secondText = page.getByRole("textbox", { name: "Question 2 text" });
  await expect(firstText).toBeEditable();
  await firstText.click();
  await page.keyboard.type("Soal pertama");
  await expect(secondText).toBeEditable();
  await secondText.click();
  await page.keyboard.type("Soal kedua");
  await expect(second).toContainText("Soal kedua");

  // The canvas holds only the papers. The teacher layer of the chosen page stands in the panel
  // beside it: the teacher goes back to the first page, then sets five points, the key, and an
  // explanation there. A choice is marked by the server, so its layer holds no rubric.
  await firstText.click();
  const panel = page.getByRole("complementary", { name: "For teachers" });
  await expect(panel).toContainText("Question 1");
  await expect(
    page
      .getByRole("region", { name: FIRST_QUESTION })
      .getByRole("textbox", { name: "Points" })
  ).toHaveCount(0);
  const points = panel.getByRole("textbox", { name: "Points" });
  await expect(points).toHaveValue("1");
  await points.fill("5");
  await points.press("Enter");
  await expect(points).toHaveValue("5");
  // The answer key is marked in the layer, so the paper of the student carries no mark.
  const keyOfB = panel.getByRole("button", {
    name: "Mark option B of question 1 as correct",
  });
  await keyOfB.click();
  await expect(keyOfB).toHaveAttribute("aria-pressed", "true");
  await expect(
    panel.getByRole("textbox", { name: "Rubric of question 1" })
  ).toHaveCount(0);
  // The explanation takes typing once it has opened its document, as a question's text does.
  const explanation = panel.getByRole("textbox", {
    name: "Explanation of question 1",
  });
  await expect(explanation).toBeEditable();
  await explanation.click();
  await page.keyboard.type("Dua tambah tiga sama dengan lima.");

  // The arrow keys move the focused grip's page one place, and the focus stays on that grip.
  await page.getByRole("button", { name: GRIP_OF_SECOND }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: GRIP_OF_FIRST })).toBeFocused();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal kedua");

  // The first question has no place above it, so its arrow key leaves the order as it is.
  await page.getByRole("button", { name: GRIP_OF_FIRST }).focus();
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
  // A press off the window lands on no grip and starts no drag.
  expect(source.y).toBeLessThan(DESKTOP.height);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y - ABOVE_THE_FIRST_GRIP, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal pertama");

  // A move by the page's own button keeps the focus on the moved page's grip, down and back up.
  await page.getByRole("button", { name: "Move question 1 down" }).click();
  await expect(
    page.getByRole("button", { name: GRIP_OF_SECOND })
  ).toBeFocused();
  await page.getByRole("button", { name: "Move question 2 up" }).click();
  await expect(page.getByRole("button", { name: GRIP_OF_FIRST })).toBeFocused();
  await expect(
    page.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal pertama");

  // Everything reaches the server, so the editor opened again shows the order and, in the panel of
  // the first page, which a new visit starts on, the layer.
  const reopened = await context.newPage();
  await reopened.goto(page.url());
  await openExam(reopened);
  await expect(
    reopened.getByRole("region", { name: FIRST_QUESTION })
  ).toContainText("Soal pertama", {
    timeout: readinessTimeoutMilliseconds,
  });
  const reopenedPanel = reopened.getByRole("complementary", {
    name: "For teachers",
  });
  await expect(
    reopenedPanel.getByRole("textbox", { name: "Points" })
  ).toHaveValue("5");
  await expect(
    reopenedPanel.getByRole("button", {
      name: "Mark option B of question 1 as correct",
    })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    reopenedPanel.getByRole("textbox", { name: "Explanation of question 1" })
  ).toContainText("Dua tambah tiga sama dengan lima.", {
    timeout: readinessTimeoutMilliseconds,
  });
  await context.close();
});
