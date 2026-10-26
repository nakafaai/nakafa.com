import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, type Page, test } from "@playwright/test";
import { Effect, FileSystem } from "effect";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The Owner value of the Filter menu's Role group. */
const OWNER_OPTION = /^Owner/;

/** Adds one cohort of grade 7 to the active period, from the cohorts page. */
async function addCohort(page: Page, name: string) {
  const add = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await dialog.getByRole("button", { name: "Add cohort" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
}

test("an admin opens the profile and the periods of a school", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings"));
  await expect(page).toHaveURL(address("/settings/profile"));
  // The profile shows two cards: the school logo, and the address with its copy action.
  await expect(page.getByText("School logo", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "School address" })
  ).toHaveValue(`${school.slug}.nakafa.com`);
  const addressCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("School address", { exact: true }) });
  await expect(
    addressCard.getByRole("button", { name: "Copy address" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Periods" }).click();
  await expect(page).toHaveURL(address("/settings/periods"));
  await expect(
    page.locator("header").getByRole("button", { name: "Add period" })
  ).toBeVisible();
  await expect(page.getByText("No period yet.")).toBeVisible();

  // The links of the settings stay on the school host, whose paths carry no
  // locale: View trail opens the audit trail, and the breadcrumb's Home opens
  // the school's own home.
  await page.goto(address("/settings/policies"));
  await page.getByRole("link", { name: "View trail" }).click();
  await expect(page).toHaveURL(address("/settings/audit"));
  await expect(
    page.getByRole("cell", { exact: true, name: "School opened" })
  ).toBeVisible();
  // Export, the trail's main action, hands over the whole trail as a CSV file.
  const download = page.waitForEvent("download");
  await page.locator("header").getByRole("button", { name: "Export" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    new RegExp(`^audit-${school.slug}-\\d{4}-\\d{2}-\\d{2}\\.csv$`)
  );
  const csv = await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Effect.promise(() => file.path());
      return yield* fs.readFileString(path);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
  expect(csv).toContain("When,Who,Change\r\n");
  expect(csv).toContain(",School opened\r\n");
  await page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL(address("/"));
  await context.close();
});

test("an admin opens a period, then creates and renames a cohort of it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  // A cohort belongs to the active period, so the admin opens a period first.
  await page.goto(address("/settings/periods"));
  const addPeriod = page
    .locator("header")
    .getByRole("button", { name: "Add period" });
  await waitUntilTakenOver(addPeriod);
  await addPeriod.click();
  const periodDialog = page.getByRole("dialog");
  await periodDialog.getByLabel("Name").fill("Semester 1");
  await periodDialog.getByLabel("First day").fill("2027-07-01");
  await periodDialog.getByLabel("Last day").fill("2027-12-20");
  await periodDialog.getByRole("button", { name: "Add period" }).click();
  const periodRow = page.getByRole("row", { name: "Semester 1" });
  await periodRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect(periodRow.getByText("Active")).toBeVisible();

  await page.goto(address("/settings/cohorts"));
  await expect(page).toHaveURL(address("/settings/cohorts"));
  const addCohortAction = page
    .locator("header")
    .getByRole("button", { name: "Add cohort" });
  await waitUntilTakenOver(addCohortAction);
  await addCohortAction.click();
  const cohortDialog = page.getByRole("dialog");
  await cohortDialog.getByLabel("Name").fill("7A");
  await cohortDialog.getByRole("combobox", { name: "Grade" }).click();
  await page.getByRole("option", { exact: true, name: "7" }).click();
  await cohortDialog.getByRole("button", { name: "Add cohort" }).click();
  const cohortRow = page.getByRole("row", { name: "7A" });
  await expect(cohortRow).toBeVisible();

  await cohortRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog");
  await renameDialog.getByLabel("Name").fill("7 Biru");
  await renameDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: "7 Biru" })).toBeVisible();
  await context.close();
});

test("an admin places a student in a cohort, then moves the student to another", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learnerAddress = `student-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learnerAddress,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  await Effect.runPromise(grantStudent(school.slug, learnerAddress));
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/periods"));
  const addPeriod = page
    .locator("header")
    .getByRole("button", { name: "Add period" });
  await waitUntilTakenOver(addPeriod);
  await addPeriod.click();
  const periodDialog = page.getByRole("dialog");
  await periodDialog.getByLabel("Name").fill("Semester 1");
  await periodDialog.getByLabel("First day").fill("2027-07-01");
  await periodDialog.getByLabel("Last day").fill("2027-12-20");
  await periodDialog.getByRole("button", { name: "Add period" }).click();
  await page
    .getByRole("row", { name: "Semester 1" })
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Open" }).click();

  await page.goto(address("/settings/cohorts"));
  await addCohort(page, "7A");
  await addCohort(page, "7B");

  // The admin places the learner in 7A, then moves them to 7B, which shows at once.
  await page.getByRole("link", { name: "7A" }).click();
  await page
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placeDialog = page.getByRole("dialog");
  await placeDialog.getByRole("combobox", { name: "Student" }).click();
  await page.getByRole("option", { name: "Acceptance Learner" }).click();
  await placeDialog.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(
    1
  );

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Move" }).click();
  const moveDialog = page.getByRole("dialog");
  await moveDialog.getByRole("combobox", { name: "Move to" }).click();
  await page.getByRole("option", { exact: true, name: "7B" }).click();
  await moveDialog.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.getByText("No student yet.")).toBeVisible();

  await page.goto(address("/settings/cohorts"));
  await page.getByRole("link", { name: "7B" }).click();
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(
    1
  );
  await context.close();
});

test("a teacher of the school, who may not manage it, sees no settings", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInTeacher(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/profile"));
  await expect(page.getByRole("link", { name: "Periods" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add period" })).toHaveCount(0);
  await context.close();
});

test("an admin reads the role guide and finds the owner's grant on Roles", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/roles"));
  const header = page
    .locator("header")
    .filter({ has: page.getByRole("button", { name: "Give role" }) });
  await expect(
    header.getByRole("button", { name: "Role guide" })
  ).toBeVisible();
  await header.getByRole("button", { name: "Role guide" }).click();
  const guide = page.getByRole("dialog", { name: "What each role may do" });
  await expect(guide.getByText("Owner", { exact: true })).toBeVisible();
  await expect(guide.getByText("Teacher", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const ownerGrant = page
    .getByRole("row")
    .filter({ hasText: "Acceptance Owner" });
  await expect(
    ownerGrant.getByRole("cell", { name: "Owner", exact: true })
  ).toBeVisible();

  // The page is header and body: the header row holds the search box and the one Filter
  // menu before the page's actions, and the table fills the body from edge to edge.
  const search = header.getByRole("textbox", { name: "Find a person" });
  await expect(search).toBeVisible();
  const table = page.locator('[data-slot="table-container"]');
  const [headerBox, tableBox] = await Promise.all([
    header.boundingBox(),
    table.boundingBox(),
  ]);
  expect(
    Math.abs((headerBox?.width ?? 0) - (tableBox?.width ?? 0))
  ).toBeLessThanOrEqual(1);
  await expect(
    ownerGrant.getByRole("button", { name: "More actions" })
  ).toBeVisible();

  // A role chosen in the Filter menu stays in its menu while the search hides every
  // row, so it can be unchosen, and the grant shows again once both are cleared. Each
  // value of the menu carries its icon.
  const filter = header.getByRole("button", { name: "Filter" });
  await filter.click();
  const owner = page.getByRole("menuitemcheckbox", { name: OWNER_OPTION });
  await expect(owner.locator("svg").first()).toBeVisible();
  await owner.click();
  await page.keyboard.press("Escape");
  await search.fill("Zygmunt");
  await expect(ownerGrant).toHaveCount(0);
  await filter.click();
  await expect(owner).toBeChecked();
  await owner.click();
  await expect(owner).not.toBeChecked();
  await page.keyboard.press("Escape");
  await search.fill("");
  await expect(ownerGrant).toHaveCount(1);
  await context.close();
});

test("on a phone a table page keeps one header row: the search opens from its button, and nothing scrolls sideways", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 844, width: 320 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/roles"));
  const header = page.locator('[data-slot="page-header"]');
  await expect(header.getByRole("button", { name: "Give role" })).toBeVisible();
  await expect(header).toHaveCSS("height", "64px");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await waitUntilTakenOver(
    header.getByRole("button", { name: "Find a person" })
  );
  await header.getByRole("button", { name: "Find a person" }).click();
  await page.getByRole("textbox", { name: "Find a person" }).fill("Zygmunt");
  await expect(
    page.getByRole("row").filter({ hasText: "Acceptance Owner" })
  ).toHaveCount(0);
  await context.close();
});

test("an admin sees that no login card is issued yet on Student accounts, and the header offers Add student", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/students"));
  const header = page
    .locator("header")
    .filter({ has: page.getByRole("button", { name: "Add student" }) });
  await expect(
    header.getByRole("button", { name: "Add student" })
  ).toBeVisible();
  await expect(page.getByText("No login card issued yet.")).toBeVisible();
  await context.close();
});
