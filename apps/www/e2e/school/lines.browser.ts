import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The address of an exam's try as a student on the school host. */
const TRY_PATH = /\/exams\/[^/]+\/try$/u;

/** The end of an editor's address, which the try's address replaces. */
const EDIT_SUFFIX = /\/edit$/u;

/** How far a line's end may stand from the middle of its dot, in the board's pixels. */
const DOT_TOLERANCE = 1.5;

/**
 * The farthest any line of a board ends from the middle of its dot, in the board's own pixels, or -1 for a board
 * with no line. Playwright runs it in the page, where no import reaches.
 */
function lineGap(board: Element) {
  const box = board.getBoundingClientRect();
  const width = board instanceof HTMLElement ? board.offsetWidth : box.width;
  const scale = width === 0 ? 1 : box.width / width;
  const centerOf = (id: string | null) => {
    const dot = board.querySelector(`[data-line-dot="${id ?? ""}"]`);
    if (dot === null) {
      return null;
    }
    const rect = dot.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - box.left) / scale,
      y: (rect.top + rect.height / 2 - box.top) / scale,
    };
  };
  let gap = -1;
  for (const path of board.querySelectorAll("path[data-line-source]")) {
    // A line's path reads "M x y C x y x y x y": its numbers, split on spaces, start and end at its dots.
    const numbers = (path.getAttribute("d") ?? "")
      .split(" ")
      .map(Number)
      .filter(Number.isFinite);
    const from = centerOf(path.getAttribute("data-line-source"));
    const to = centerOf(path.getAttribute("data-line-answer"));
    if (from === null || to === null || numbers.length < 8) {
      return Number.POSITIVE_INFINITY;
    }
    gap = Math.max(
      gap,
      Math.hypot((numbers[0] ?? 0) - from.x, (numbers[1] ?? 0) - from.y),
      Math.hypot((numbers[6] ?? 0) - to.x, (numbers[7] ?? 0) - to.y)
    );
  }
  return gap;
}

/** Drags with the mouse from the middle of one element to the middle of another, as a person pulls a line. */
async function pull(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  if (start === null || end === null) {
    return;
  }
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

test("a teacher pulls, presses, and keys lines between statements and answers, takes one away, and the student joins one with a tap on a phone", async ({
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
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Garis");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("Jodohkan ibu kota dengan negaranya.");
  await page
    .getByRole("button", { name: "Question type: Multiple choice" })
    .click();
  await page.getByRole("menuitemradio", { name: "Matching" }).click();

  const canvas = page.getByRole("region", { name: "Exam pages" });
  const panel = page.getByRole("complementary", { name: "For teachers" });

  // A pull from statement 1's dot to answer B draws the line, and the teacher's key shows it too.
  await pull(
    page,
    canvas.getByRole("button", { name: "Statement 1, not joined" }),
    canvas.getByRole("button", { exact: true, name: "Answer B" })
  );
  await expect(
    canvas.getByRole("button", { name: "Statement 1, joined to B" })
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Statement 1, joined to B" })
  ).toBeVisible();

  // The keyboard joins statement 2 to answer C: Enter takes the statement and moves to the answers, the arrows walk
  // them, and Enter joins.
  await panel.getByRole("button", { name: "Statement 2, not joined" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    panel.getByRole("button", { exact: true, name: "Answer A" })
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    panel.getByRole("button", { name: "Statement 2, joined to C" })
  ).toBeVisible();

  // Each line meets the middle of its dots, on a wide screen and on a phone's width.
  const board = canvas.locator("[data-lines]");
  await expect.poll(() => board.evaluate(lineGap)).toBeGreaterThanOrEqual(0);
  expect(await board.evaluate(lineGap)).toBeLessThanOrEqual(DOT_TOLERANCE);
  await page.setViewportSize({ height: 844, width: 390 });
  await expect
    .poll(() => board.evaluate(lineGap))
    .toBeLessThanOrEqual(DOT_TOLERANCE);
  await page.setViewportSize({ height: 900, width: 1440 });

  // The line's own control takes it away, shown once the pointer rests on the line's statement.
  await canvas
    .getByRole("button", { name: "Statement 1, joined to B" })
    .hover();
  const remove = canvas.getByRole("button", {
    name: "Remove the line of statement 1",
  });
  await expect(remove).toHaveCSS("opacity", "1");
  await remove.click();
  await expect(
    canvas.getByRole("button", { name: "Statement 1, not joined" })
  ).toBeVisible();

  // On a phone the student taps statement 3, then the row of answer A, and the line joins them.
  const phone = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  await Effect.runPromise(
    signInOwner(phone, school.slug, hostAddress(baseURL, host, "/"))
  );
  const trying = await phone.newPage();
  await trying.goto(page.url().replace(EDIT_SUFFIX, "/try"));
  await trying.waitForURL(TRY_PATH);
  const statement = trying.getByRole("button", {
    name: "Statement 3, not joined",
  });
  await expect(statement).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await statement.tap();
  await expect(statement).toHaveAttribute("aria-pressed", "true");
  await trying.getByRole("button", { exact: true, name: "Answer A" }).tap();
  await expect(
    trying.getByRole("button", { name: "Statement 3, joined to A" })
  ).toBeVisible();
  // A tap on the answer it holds takes the line away again.
  await trying.getByRole("button", { name: "Statement 3, joined to A" }).tap();
  await trying.getByRole("button", { exact: true, name: "Answer A" }).tap();
  await expect(
    trying.getByRole("button", { name: "Statement 3, not joined" })
  ).toBeVisible();
  await phone.close();
  await context.close();
});
