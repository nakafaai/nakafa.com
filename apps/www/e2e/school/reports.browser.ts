import { expect, type Page, test } from "@playwright/test";
import { Effect, Option, String as Str } from "effect";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A web address, as an opened PDF has. */
const WEB_ADDRESS = /^https?:\/\//;

/** The hash at the end of a check page's address. */
const CHECK_HASH = /\/verify\/([0-9a-f]{64})$/;

/** Opens the row menu of one student on a report list and chooses one item. */
async function chooseFromRow(page: Page, student: string, item: string) {
  const row = page.getByRole("row").filter({ hasText: student });
  const menu = row.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(menu);
  await menu.click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("a homeroom teacher writes and hands in a report card, the Owner approves it, and its check page answers", async ({
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
  const teacher = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(teacher, school.slug, address("/"))
  );

  // The Owner places the learner in X-1 and makes the class teacher its homeroom teacher.
  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const settings = await owner.newPage();
  await settings.goto(address("/settings/cohorts"));
  const cohortLink = settings.getByRole("link", { name: "X-1" });
  await waitUntilTakenOver(cohortLink);
  await cohortLink.click();
  await settings
    .locator("header")
    .getByRole("button", { name: "Add student" })
    .click();
  const placeDialog = settings.getByRole("dialog");
  await placeDialog.getByRole("combobox", { name: "Student" }).click();
  await settings.getByRole("option", { name: "Acceptance Learner" }).click();
  await placeDialog.getByRole("button", { name: "Add student" }).click();
  // The homeroom teacher is chosen in the dialog behind the header's Homeroom teacher button.
  await settings
    .locator("header")
    .getByRole("button", { name: "Homeroom teacher" })
    .click();
  const homeroom = settings.getByRole("dialog", { name: "Homeroom teacher" });
  await homeroom.getByRole("combobox", { name: "Teacher" }).click();
  await settings
    .getByRole("option", { name: "Acceptance Class Teacher" })
    .click();
  await homeroom.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(homeroom).toBeHidden();

  // The subject teacher releases the learner's grade, which the report shows.
  const page = await teacher.newPage();
  await page.goto(address("/classes/fisika-x-1/grades"));
  const gradeRow = page
    .getByRole("row")
    .filter({ hasText: "Acceptance Learner" });
  const field = gradeRow.getByRole("textbox");
  await expect(field).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(field);
  await field.fill("82");
  await field.press("Enter");
  await expect(gradeRow).toContainText("Draft");
  await gradeRow.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Release" }).click();
  await expect(gradeRow).toContainText("Released");

  // The homeroom teacher opens the class group from the report cards and writes the note.
  await page.goto(address("/reports"));
  const reportsCohort = page.getByRole("link", { name: "X-1" });
  await expect(reportsCohort).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await reportsCohort.click();
  const row = page.getByRole("row").filter({ hasText: "Acceptance Learner" });
  await expect(row).toContainText("Not started", {
    timeout: readinessTimeoutMilliseconds,
  });
  await chooseFromRow(page, "Acceptance Learner", "Write note");
  const noteDialog = page.getByRole("dialog");
  await noteDialog
    .getByLabel("Homeroom teacher's note")
    .fill("Rajin dan teliti.");
  await noteDialog.getByRole("button", { name: "Save note" }).click();
  await expect(row).toContainText("Draft");
  await chooseFromRow(page, "Acceptance Learner", "Hand in");
  await expect(row).toContainText("Handed in");
  await page.reload();
  await expect(row).toContainText("Handed in", {
    timeout: readinessTimeoutMilliseconds,
  });

  // The Owner approves it; the PDF is drawn and the report locks.
  const approver = await owner.newPage();
  await approver.goto(page.url());
  const approverRow = approver
    .getByRole("row")
    .filter({ hasText: "Acceptance Learner" });
  await expect(approverRow).toContainText("Handed in", {
    timeout: readinessTimeoutMilliseconds,
  });
  await chooseFromRow(approver, "Acceptance Learner", "Approve");
  await expect(approverRow).toContainText("Locked", {
    timeout: readinessTimeoutMilliseconds,
  });
  // The locked report opens beside the list with its copied grade, its PDF and its check page.
  await approverRow.getByRole("button", { name: "Acceptance Learner" }).click();
  const detail = approver.getByRole("complementary", {
    name: "Student's report card",
  });
  await expect(detail.getByRole("cell", { name: "Fisika X-1" })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Open PDF" })).toHaveAttribute(
    "href",
    WEB_ADDRESS
  );
  const check = await detail
    .getByRole("link", { name: "Open check page" })
    .getAttribute("href");
  const code = Option.getOrElse(
    Option.flatMap(Str.match(CHECK_HASH)(check ?? ""), (found) =>
      Option.fromNullishOr(found[1])
    ),
    () => ""
  );
  expect(code).toHaveLength(64);

  // The check page answers the school and the period on the main site, and nothing for another code.
  const visitor = await browser.newContext();
  const checkPage = await visitor.newPage();
  await checkPage.goto(hostAddress(baseURL, "localhost", `/en/verify/${code}`));
  await expect(
    checkPage.getByText("This report card is on record.")
  ).toBeVisible();
  await checkPage.goto(
    hostAddress(baseURL, "localhost", `/en/verify/${"0".repeat(64)}`)
  );
  await expect(
    checkPage.getByText("No report card has this code.")
  ).toBeVisible();
  await visitor.close();
  await owner.close();
  await teacher.close();
});
