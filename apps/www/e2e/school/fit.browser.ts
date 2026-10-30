import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The grid's card of the first question, whose name opens it and may add that it has no key yet. */
const FIRST_CARD = /^Open question 1\b/;

/** Whether the value an element shows fits inside it, uncut by an ellipsis. */
function fitsWhole(element: Element) {
  const value = element.querySelector('[data-slot="select-value"]');
  return value !== null && value.scrollWidth <= value.clientWidth;
}

/**
 * The alignment a thumbnail's paper gives text that sets none of its own, such as a heading or a list
 * item: the start, as on the page, and not the centre of the button that holds the thumbnail.
 */
function thumbnailAlign(card: Element) {
  const paper = card.querySelector("[inert]");
  return paper === null ? "" : getComputedStyle(paper).textAlign;
}

/**
 * The tops of the first text line of a paper table's column heading and of the statements' heading in
 * its row: equal when the row stands its headings on one line.
 */
function headingLines(column: Element) {
  const top = (node: Node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return Math.round(range.getBoundingClientRect().top);
  };
  const statements = column.closest(".grid-cols-subgrid")?.children.item(1);
  return {
    column: top(column),
    statements:
      statements === null || statements === undefined ? -1 : top(statements),
  };
}

test("the teacher's paper shows each matching key's placeholder whole, a true or false table's headings on one line, and its thumbnails from the start", async ({
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
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Tabel");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });

  // Each statement's key select in the teacher layer shows its placeholder whole, as the student's
  // paper shows its own.
  await page
    .getByRole("button", { name: "Question type: Multiple choice" })
    .click();
  await page.getByRole("menuitemradio", { name: "Matching" }).click();
  const keys = page.getByRole("combobox", {
    name: "Answer for statement 1 of question 1",
  });
  await expect(keys).toHaveText("Choose");
  expect(await keys.evaluate(fitsWhole)).toBe(true);

  // A true or false table's column headings stand on the line of the statements' heading.
  await page.getByRole("button", { name: "Question type: Matching" }).click();
  await page
    .getByRole("menuitemradio", { name: "True or false table" })
    .click();
  for (const column of ["A", "B"]) {
    const heading = page.getByRole("textbox", {
      name: `Question 1, column ${column}`,
    });
    await expect(heading).toBeVisible();
    const lines = await heading.evaluate(headingLines);
    expect(lines.column).toBe(lines.statements);
  }

  // A page's thumbnail in the grid lays its text out as the page does, from the start.
  await page.getByRole("button", { name: "Grid view" }).click();
  const card = page.getByRole("button", { name: FIRST_CARD });
  await expect(card).toBeVisible();
  expect(await card.evaluate(thumbnailAlign)).toBe("start");
  await context.close();
});
