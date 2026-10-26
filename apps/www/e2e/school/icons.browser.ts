import { expect, type Locator, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The trigger that names a question's type. */
const QUESTION_TYPE = /^Question type: /;

/** The markup of the icon a control draws, so two controls compare by what they show. */
const iconOf = (control: Locator) =>
  control
    .locator("svg")
    .last()
    .evaluate((icon) => icon.innerHTML);

test("a class in the school sidebar carries its animal, and only the Classes label carries an icon", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const home = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(context, school.slug, home));
  const page = await context.newPage();
  await page.goto(home);

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const entry = sidebar.getByRole("link", { exact: true, name: "Fisika X-1" });
  await expect(entry.locator('[data-slot="avatar"]')).toHaveCount(1);
  await expect(
    sidebar
      .locator('[data-slot="sidebar-group-label"]')
      .filter({ hasText: "Classes" })
      .locator("svg")
  ).toHaveCount(1);
  await context.close();
});

test("the exam editor draws one icon per action: more actions, the question type, moving a page, adding below and adding an option", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/exams"));

  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Ikon");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  await page.getByRole("button", { exact: true, name: "Add question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
  await page.getByRole("textbox", { name: "Question 1 text" }).click();

  const icons = await Promise.all(
    Arr.map(
      [
        page.locator("header").getByRole("button", { name: "More actions" }),
        page.getByRole("button", { name: QUESTION_TYPE }).first(),
        page.getByRole("button", { name: "Move question 1 down" }),
        page.getByRole("button", { name: "Add question below question 1" }),
        page.getByRole("button", { exact: true, name: "Add option" }).first(),
      ],
      iconOf
    )
  );
  expect(Arr.dedupe(icons)).toEqual(icons);
  await context.close();
});
