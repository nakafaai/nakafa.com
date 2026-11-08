import { expect, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import {
  createSchool,
  hostAddress,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  openNewExam,
  pressTool,
  selectBack,
  TOOLBAR,
  tableShape,
  watchFailures,
} from "@/e2e/support/toolbar";

/** The widths a teacher edits at: a phone and a desktop. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

for (const viewport of WIDTHS) {
  test(`at ${viewport.width}px a table carries its own bar, whose every command stays after a reload, and the keyboard leaves and removes a table`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();
    const failures = watchFailures(page);
    const prompt = await openNewExam(
      page,
      hostAddress(baseURL, host, "/exams"),
      "Uji tabel"
    );
    await prompt.click();
    await page.keyboard.type("Soal");

    // The toolbar's controls keep their places while the caret enters a table: the table's actions
    // are in its own bar, never a control that appears in the row.
    const toolbar = page.locator(TOOLBAR);
    const undo = toolbar.getByRole("button", { exact: true, name: "Undo" });
    const before = await undo.boundingBox();
    await pressTool(page, "Table");
    await expect(prompt.locator("table")).toBeVisible();
    expect(await undo.boundingBox()).toEqual(before);

    // The bar stands at the table while the caret is in it. The caret goes to the body row, and each
    // command does what it says.
    const bar = page.getByRole("toolbar", { name: "Table" });
    await expect(bar).toBeVisible();
    await page.keyboard.type("Kolom");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type("isi");
    for (const command of [
      { columns: 2, name: "Row below", rows: 3 },
      { columns: 2, name: "Row above", rows: 4 },
      { columns: 2, name: "Delete row", rows: 3 },
      { columns: 3, name: "Column right", rows: 3 },
      { columns: 4, name: "Column left", rows: 3 },
      { columns: 3, name: "Delete column", rows: 3 },
    ]) {
      await bar
        .getByRole("button", { exact: true, name: command.name })
        .click();
      await expect
        .poll(() => tableShape(prompt))
        .toEqual({ columns: command.columns, rows: command.rows });
      await expect(prompt).toBeFocused();
    }

    // A mark of the toolbar takes words in a cell.
    await prompt.locator("td").first().click();
    await page.keyboard.type("sel");
    await selectBack(page, "sel".length);
    await pressTool(page, "Bold");
    await expect(prompt.locator("td strong")).toHaveText("sel");

    // Escape leaves the table: the bar goes, and the next words land in the line after it.
    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
    await page.keyboard.type("luar");
    await expect(prompt.locator("table")).not.toContainText("luar");
    await expect(prompt.locator("p").last()).toHaveText("luar");

    // Every command was saved: the editor opened again holds the same table. It opens beside this
    // page, whose saves still on their way land meanwhile, where a reload would cancel them.
    const second = await context.newPage();
    const secondFailures = watchFailures(second);
    await second.goto(page.url());
    const reopened = second.getByRole("textbox", { name: "Question 1 text" });
    await expect(reopened).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect
      .poll(() => tableShape(reopened))
      .toEqual({ columns: 3, rows: 3 });
    await expect(reopened.locator("td strong")).toHaveText("sel");

    // The bar removes the table.
    await reopened.locator("td").first().click();
    await second
      .getByRole("toolbar", { name: "Table" })
      .getByRole("button", { exact: true, name: "Delete table" })
      .click();
    await expect(reopened.locator("table")).toHaveCount(0);

    // A table that holds nothing goes with Backspace, and with Delete.
    for (const key of ["Backspace", "Delete"]) {
      await pressTool(second, "Table");
      await expect(reopened.locator("table")).toHaveCount(1);
      await second.keyboard.press(key);
      await expect(reopened.locator("table")).toHaveCount(0);
    }
    expect(MutableList.toArray(failures)).toEqual([]);
    expect(MutableList.toArray(secondFailures)).toEqual([]);
    await context.close();
  });
}

test("two teachers edit one question at once, one through the table's bar and one typing, and both screens and the server hold every change with no refusal", async ({
  baseURL,
  browser,
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
  const ownerFailures = watchFailures(owner);
  const ownerPrompt = await openNewExam(
    owner,
    hostAddress(baseURL, host, "/exams"),
    "Uji bersama"
  );
  await ownerPrompt.click();
  await owner.keyboard.type("Soal bersama");
  await pressTool(owner, "Table");

  const teacher = await teacherContext.newPage();
  const teacherFailures = watchFailures(teacher);
  await teacher.goto(owner.url());
  const teacherPrompt = teacher.getByRole("textbox", {
    name: "Question 1 text",
  });
  await expect(teacherPrompt.locator("table")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // The teacher writes at the end of the first line while the owner adds a column and a row.
  await teacherPrompt
    .locator("p")
    .first()
    .click({ position: { x: 300, y: 6 } });
  await teacher.keyboard.press("End");
  const ownerBar = owner.getByRole("toolbar", { name: "Table" });
  await Promise.all([
    teacher.keyboard.type(" dan guru"),
    (async () => {
      // The owner's caret goes back into the table, where its bar stands.
      await ownerPrompt.locator("th").first().click();
      await ownerBar
        .getByRole("button", { exact: true, name: "Column right" })
        .click();
      await ownerBar
        .getByRole("button", { exact: true, name: "Row below" })
        .click();
    })(),
  ]);

  for (const prompt of [ownerPrompt, teacherPrompt]) {
    await expect
      .poll(() => tableShape(prompt), { timeout: readinessTimeoutMilliseconds })
      .toEqual({ columns: 3, rows: 3 });
    await expect(prompt.locator("p").first()).toHaveText(
      "Soal bersama dan guru",
      { timeout: readinessTimeoutMilliseconds }
    );
  }
  expect(MutableList.toArray(ownerFailures)).toEqual([]);
  expect(MutableList.toArray(teacherFailures)).toEqual([]);
  await teacherContext.close();
  await ownerContext.close();
});
