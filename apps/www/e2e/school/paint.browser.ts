import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The page global that holds the part's controls as the part first drew them. */
const FIRST_CONTROLS = "__nakafaFirstControls";

/** The page's one header. */
const HEADER = '[data-slot="page-header"]';

/** The row of the seeded exam's open room in the exam's rooms. */
const OPEN_ROOM_ROW = /Lab 2/u;

/** The tab row of a class. */
const CLASS_TABS = '[role="tablist"][aria-label="Class"]';

/**
 * Records, before the page's scripts run, the controls of one part of the page as they stand the first time the part
 * is in the document: each one's name, whether it is disabled or `aria-disabled`, and its opacity, in order. The
 * record is taken in the mutation's own callback, before the browser paints. The page serializes this function, so it
 * reads each control in its own body.
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
      Array.from(part.querySelectorAll("a, button, input")).map((control) => ({
        ariaDisabled: control.getAttribute("aria-disabled"),
        disabled: control.matches(":disabled"),
        name:
          control.getAttribute("aria-label") ??
          control.getAttribute("placeholder") ??
          control.textContent?.trim() ??
          "",
        opacity: getComputedStyle(control).opacity,
      }))
    );
    observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

/** The part's controls as they stand now, read the way the first record reads them. */
function readControls(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((part) =>
      Array.from(part.querySelectorAll("a, button, input")).map((control) => ({
        ariaDisabled: control.getAttribute("aria-disabled"),
        disabled: control.matches(":disabled"),
        name:
          control.getAttribute("aria-label") ??
          control.getAttribute("placeholder") ??
          control.textContent?.trim() ??
          "",
        opacity: getComputedStyle(control).opacity,
      }))
    );
}

/** A control as a record holds it, read for its name alone. */
const NamedControls = Schema.Array(Schema.Struct({ name: Schema.String }));

/** The names of controls as a record holds them, for a part that may draw its controls before it can act. */
const namesOf = (controls: unknown) =>
  Arr.map(
    Schema.decodeUnknownSync(NamedControls)(controls),
    (control) => control.name
  );

/** A control as a record holds it, read for how far it acts. */
const StatedControls = Schema.Array(
  Schema.Struct({ disabled: Schema.Boolean, opacity: Schema.String })
);

/** How far each control acts, for a part that names a record it has yet to read. */
const statesOf = (controls: unknown) =>
  Schema.decodeUnknownSync(StatedControls)(controls);

/** The part's controls as the first record holds them. */
function readFirstControls(page: Page) {
  return page.evaluate((key) => Reflect.get(window, key), FIRST_CONTROLS);
}

/**
 * Opens a School page, waits until what shows its data has drawn, and checks that its header held the same controls
 * from its first paint, in the same order, each as enabled and as opaque as it ends, and that nothing on the page
 * moved while it loaded. A part that draws its controls before it can act is compared by `names` alone, and a path that
 * names a record, whose words only the record's read holds, by `states` alone.
 */
async function expectSteadyHeader(
  page: Page,
  address: string,
  drawn: Locator,
  compared: "controls" | "names" | "states" = "controls"
) {
  await page.addInitScript(recordFirstControls, {
    key: FIRST_CONTROLS,
    selector: HEADER,
  });
  await page.goto(address);
  await expect(drawn).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await page.waitForLoadState("load");
  const [first, now] = [
    await readFirstControls(page),
    await readControls(page, HEADER),
  ];
  if (compared === "names") {
    expect(namesOf(first)).toEqual(namesOf(now));
  } else if (compared === "states") {
    expect(statesOf(first)).toEqual(statesOf(now));
  } else {
    expect(first).toEqual(now);
  }
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

  // A school with no active period keeps Add cohort in the header, ready, beside the search, and its dialog says why
  // its add waits.
  const cohorts = await context.newPage();
  await expectSteadyHeader(
    cohorts,
    address("/settings/cohorts"),
    cohorts.getByText("No active period.")
  );
  const addCohortAction = cohorts.getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(addCohortAction);
  await addCohortAction.click();
  const addCohort = cohorts.getByRole("dialog");
  await expect(
    addCohort.getByText(
      "Open a period first: a cohort joins the unit's active period."
    )
  ).toBeVisible();
  await expect(
    addCohort.getByRole("button", { name: "Add cohort" })
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
    rooms.getByRole("row", { name: OPEN_ROOM_ROW }),
    "states"
  );
  await rooms.close();

  // The editor draws its header with the title's field empty and its buttons disabled, then fills the title in, so its
  // header is compared by its controls' names.
  const editor = await context.newPage();
  await expectSteadyHeader(
    editor,
    address(`/exams/${sitting.examId}/edit`),
    editor.locator("main footer"),
    "names"
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

/** How long a settings page gets to draw its live answers before its header is read again. */
const SETTLE_MILLISECONDS = 4000;

/** Every School settings page, by its address under the school's host. */
const SETTINGS_PAGES = [
  "/settings/profile",
  "/settings/units",
  "/settings/periods",
  "/settings/cohorts",
  "/settings/classes",
  "/settings/grading",
  "/settings/members",
  "/settings/invites",
  "/settings/students",
  "/settings/roles",
  "/settings/guardians",
  "/settings/roster",
  "/settings/clients",
  "/settings/connections",
  "/settings/policies",
  "/settings/billing",
  "/settings/audit",
];

/** The School pages of the sidebar's main group that an Owner opens. */
const OWNER_PAGES = ["/notifications", "/exams", "/reports"];

/** The School pages of the sidebar's main group that a student opens: their exams, grades and report cards. */
const STUDENT_PAGES = ["/sittings", "/grades", "/cards"];

/**
 * Opens one School page in its own tab, gives its live reads time to answer, and checks that its header held the
 * same controls from its first paint, each as enabled and as opaque as it ends, and that nothing on it moved.
 */
async function expectSettledHeader(
  context: BrowserContext,
  address: string,
  path: string
) {
  const page = await context.newPage();
  await page.addInitScript(recordFirstControls, {
    key: FIRST_CONTROLS,
    selector: HEADER,
  });
  await page.goto(address);
  await expect(page.locator(HEADER).first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  // The live reads answer over Convex's socket, which no load state waits for, so the page gets time to draw every
  // answer before the header is read again. Waiting longer only makes the check stricter.
  await page.waitForLoadState("load");
  await page.waitForTimeout(SETTLE_MILLISECONDS);
  expect(await readFirstControls(page), path).toEqual(
    await readControls(page, HEADER)
  );
  expect(await Effect.runPromise(readCumulativeLayoutShift(page)), path).toBe(
    0
  );
  await page.close();
}

test("every School settings page keeps its header's controls from the first paint, enabled as they end, and nothing on it moves", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(600_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // The class teacher's seed opens a period with the cohort X-1, so the cohorts, classrooms and cohort pages hold rows.
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));

  for (const path of SETTINGS_PAGES) {
    await expectSettledHeader(context, address(path), path);
  }

  // A cohort's own page draws its path, its search and Add student final from the first paint.
  const cohorts = await context.newPage();
  await cohorts.goto(address("/settings/cohorts"));
  const cohort = cohorts.getByRole("link", { exact: true, name: "X-1" });
  await expect(cohort).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const cohortPath = Option.getOrThrow(
    Option.fromNullOr(await cohort.getAttribute("href"))
  );
  await cohorts.close();
  await expectSettledHeader(context, address(cohortPath), cohortPath);
  await context.close();
});

test("every School main page keeps its header's controls from the first paint, enabled as they end, for the Owner and for a student", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(300_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `main-${school.slug}@acceptance.example.test`;
  const student = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: student,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));

  for (const path of OWNER_PAGES) {
    await expectSettledHeader(owner, address(path), path);
  }
  for (const path of STUDENT_PAGES) {
    await expectSettledHeader(student, address(path), path);
  }
  await owner.close();
  await student.close();
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
  const first = namesOf(await readFirstControls(page));
  const now = namesOf(await readControls(page, CLASS_TABS));
  expect(first).toEqual(["Home", "Forum", "Library", "Tasks", "People"]);
  expect(Arr.take(now, 5)).toEqual(first);
  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});
