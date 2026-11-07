import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The smallest side a remove control may have, so a pointer finds it without aiming. */
const HIT_MIN = 28;

/** How far a remove control's middle may stand from its row's middle, in pixels. */
const CENTER_TOLERANCE = 1;

/** Each answer type whose parts a teacher removes, in the order the spec switches to them. */
const TYPES = [
  "Complex multiple choice",
  "True or false table",
  "Matching",
] as const;

/**
 * Checks every remove control of the paper: hidden until its row is hovered, shown on hover and on focus, at least
 * `HIT_MIN` pixels square, centered on its row's middle, and standing at the row's end.
 */
async function expectOneRemove(page: Page, canvas: Locator) {
  const removes = canvas.locator("[data-remove]");
  await expect(removes.first()).toBeAttached();
  const count = await removes.count();
  for (let index = 0; index < count; index += 1) {
    const remove = removes.nth(index);
    const row = remove.locator("xpath=..");
    await page.mouse.move(1, 1);
    await expect(remove).toHaveCSS("opacity", "0");
    await row.hover();
    await expect(remove).toHaveCSS("opacity", "1");
    const box = await remove.boundingBox();
    const rowBox = await row.boundingBox();
    if (box === null || rowBox === null) {
      throw new Error("A remove control or its row is not on the screen");
    }
    expect(box.width).toBeGreaterThanOrEqual(HIT_MIN);
    expect(box.height).toBeGreaterThanOrEqual(HIT_MIN);
    expect(
      Math.abs(box.y + box.height / 2 - (rowBox.y + rowBox.height / 2))
    ).toBeLessThanOrEqual(CENTER_TOLERANCE);
    expect(rowBox.x + rowBox.width - (box.x + box.width)).toBeLessThanOrEqual(
      8
    );
    await page.mouse.move(1, 1);
    await remove.focus();
    await expect(remove).toHaveCSS("opacity", "1");
    await remove.blur();
  }
}

test("every answer type removes a part with one control, centered on its row, at least 28 pixels square, and shown on hover and focus", async ({
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
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Hapus");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await expect(
    page.getByRole("textbox", { name: "Question 1 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  const canvas = page.getByRole("region", { name: "Exam pages" });

  // A new question is multiple choice, whose options each take the control.
  await expectOneRemove(page, canvas);
  let shown = "Multiple choice";
  for (const type of TYPES) {
    await page.getByRole("button", { name: `Question type: ${shown}` }).click();
    await page.getByRole("menuitemradio", { name: type }).click();
    await expect(
      page.getByRole("button", { name: `Question type: ${type}` })
    ).toBeVisible();
    shown = type;
    await expectOneRemove(page, canvas);
  }

  // A matching's line takes the same control, on its statement's row.
  await canvas.getByRole("button", { name: "Statement 1, not joined" }).click();
  await canvas.getByRole("button", { exact: true, name: "Answer A" }).click();
  const statement = canvas.getByRole("button", {
    name: "Statement 1, joined to A",
  });
  await statement.hover();
  const line = canvas.getByRole("button", {
    name: "Remove the line of statement 1",
  });
  await expect(line).toHaveCSS("opacity", "1");
  const lineBox = await line.boundingBox();
  const dotBox = await statement.boundingBox();
  if (lineBox === null || dotBox === null) {
    throw new Error("A line's remove control or its dot is not on the screen");
  }
  expect(lineBox.width).toBeGreaterThanOrEqual(HIT_MIN);
  expect(
    Math.abs(lineBox.y + lineBox.height / 2 - (dotBox.y + dotBox.height / 2))
  ).toBeLessThanOrEqual(CENTER_TOLERANCE);
  await context.close();
});
