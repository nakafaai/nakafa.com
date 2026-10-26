import { expect, test } from "@playwright/test";
import { Effect } from "effect";
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

test("a subject teacher enters a student's grade as a draft in the gradebook, then releases it", async ({
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

  // The school's Owner places the learner in the class's cohort, X-1 of the active period.
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
  await expect(
    settings.getByRole("button", { name: "More actions" })
  ).toHaveCount(1);
  await owner.close();

  const page = await teacher.newPage();
  await page.goto(address("/classes/fisika-x-1/grades"));
  const row = page.getByRole("row").filter({ hasText: "Acceptance Learner" });
  await expect(row).toContainText("Not entered", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page.getByRole("link", { name: "Grades" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  // A typed value shows at once as the draft, judged by the school's scheme.
  const field = row.getByRole("textbox", {
    name: "Grade of Acceptance Learner",
  });
  await waitUntilTakenOver(field);
  await field.fill("82");
  await field.press("Enter");
  await expect(row).toContainText("Draft");
  await expect(row).toContainText("Meets KKTP");
  await page.reload();
  await expect(row).toContainText("Draft", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(row.getByRole("textbox")).toHaveValue("82");

  // A value the scheme refuses goes back to the saved one.
  await row.getByRole("textbox").fill("140");
  await row.getByRole("textbox").press("Enter");
  await expect(row.getByRole("textbox")).toHaveValue("82");

  // Released, the grade shows to its student and no entry changes it.
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Release" }).click();
  await expect(row).toContainText("Released");
  await expect(row.getByRole("textbox")).toBeDisabled();
  await page.reload();
  await expect(row).toContainText("Released", {
    timeout: readinessTimeoutMilliseconds,
  });

  // The student opens beside the list with the grade, its result and the scheme's KKTP.
  const open = row.getByRole("button", { name: "Acceptance Learner" });
  await waitUntilTakenOver(open);
  await open.click();
  const detail = page.getByRole("complementary", { name: "Student's grade" });
  await expect(
    detail.getByRole("heading", { name: "Acceptance Learner" })
  ).toBeVisible();
  await expect(detail.getByRole("textbox")).toHaveValue("82");
  await expect(detail.getByText("KKTP")).toBeVisible();
  await teacher.close();
});
