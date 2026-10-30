import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page global that holds the part's controls as the part first drew them. */
const FIRST_CONTROLS = "__nakafaFirstControls";

/** The page's one header. */
const HEADER = '[data-slot="page-header"]';

/** The row of the seeded exam's open room in the exam's rooms. */
const OPEN_ROOM_ROW = /Lab 2/u;

/** The tab row of a class. */
const CLASS_TABS = 'nav[aria-label="Class"]';

/**
 * Records, before the page's scripts run, the controls of one part of the page as they stand the first time the part
 * is in the document: each one's name, in order. The record is taken in the mutation's own callback, before the
 * browser paints.
 */
function recordFirstControls({
  key,
  selector,
}: {
  key: string;
  selector: string;
}) {
  const observer = new MutationObserver(() => {
    const part = document.querySelector(selector);
    if (part === null) {
      return;
    }
    Reflect.set(
      window,
      key,
      Array.from(part.querySelectorAll("a, button, input")).map(
        (control) =>
          control.getAttribute("aria-label") ??
          control.getAttribute("placeholder") ??
          control.textContent?.trim() ??
          ""
      )
    );
    observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

/** The part's controls as they stand now, named the way the first record names them. */
function readControls(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((part) =>
      Array.from(part.querySelectorAll("a, button, input")).map(
        (control) =>
          control.getAttribute("aria-label") ??
          control.getAttribute("placeholder") ??
          control.textContent?.trim() ??
          ""
      )
    );
}

/** The part's controls as the first record holds them. */
function readFirstControls(page: Page) {
  return page.evaluate((key) => Reflect.get(window, key), FIRST_CONTROLS);
}

/**
 * Opens a School page, waits until what shows its data has drawn, and checks that its header held the same controls
 * from its first paint, in the same order, and that nothing on the page moved while it loaded.
 */
async function expectSteadyHeader(page: Page, address: string, drawn: Locator) {
  await page.addInitScript(recordFirstControls, {
    key: FIRST_CONTROLS,
    selector: HEADER,
  });
  await page.goto(address);
  await expect(drawn).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.waitForLoadState("load");
  expect(await readFirstControls(page)).toEqual(
    await readControls(page, HEADER)
  );
  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
}

test("the cohorts, exams, notifications, rooms, exam editor, periods, profile and policies pages keep their header's controls from the first paint", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `paint-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));

  // A school with no active period keeps Add cohort in the header, disabled, beside the search.
  const cohorts = await context.newPage();
  await expectSteadyHeader(
    cohorts,
    address("/settings/cohorts"),
    cohorts.getByText("No active period.")
  );
  await expect(
    cohorts.getByRole("button", { name: "Add cohort" })
  ).toBeDisabled();
  await cohorts.close();

  const examsPage = await context.newPage();
  await expectSteadyHeader(
    examsPage,
    address("/exams"),
    examsPage.getByRole("link", { name: "Ujian Acceptance" })
  );
  await examsPage.close();

  const inbox = await context.newPage();
  await expectSteadyHeader(
    inbox,
    address("/notifications"),
    inbox.getByText("You have been invited to join this school.")
  );
  await inbox.close();

  const rooms = await context.newPage();
  await expectSteadyHeader(
    rooms,
    address(`/exams/${sitting.examId}`),
    rooms.getByRole("row", { name: OPEN_ROOM_ROW })
  );
  await rooms.close();

  // The editor draws its header with the title's field empty and its buttons disabled, then fills the title in.
  const editor = await context.newPage();
  await expectSteadyHeader(
    editor,
    address(`/exams/${sitting.examId}/edit`),
    editor.locator("main footer")
  );
  await expect(editor.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "Ujian Acceptance"
  );
  await editor.close();

  // The settings pages that read only the school itself draw from the viewer the page loads with.
  const periods = await context.newPage();
  await expectSteadyHeader(
    periods,
    address("/settings/periods"),
    periods
      .getByText("No period yet.")
      .or(periods.locator('[data-slot="table-card"] tbody tr').first())
  );
  await periods.close();

  const profile = await context.newPage();
  await expectSteadyHeader(
    profile,
    address("/settings/profile"),
    profile.getByText("School logo")
  );
  await profile.close();

  const policies = await context.newPage();
  await expectSteadyHeader(
    policies,
    address("/settings/policies"),
    policies.getByRole("combobox", { name: "Nina credits a day" })
  );
  await policies.close();
  await context.close();
});

test("a class page keeps its tab row from the first paint, and nothing on it moves while the class loads", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();

  await page.addInitScript(recordFirstControls, {
    key: FIRST_CONTROLS,
    selector: CLASS_TABS,
  });
  await page.goto(address("/classes/fisika-x-1"));
  await expect(
    page.locator(HEADER).getByText("Fisika X-1").first()
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.waitForLoadState("load");

  // Every tab stood from the first paint; a viewer who keeps the grades gets the Grades tab at the row's end.
  const first = await readFirstControls(page);
  const now = await readControls(page, CLASS_TABS);
  expect(first).toEqual(["Home", "Forum", "Library", "Tasks"]);
  expect(Arr.take(now, 4)).toEqual(first);
  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});
