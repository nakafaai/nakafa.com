import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The cohort and the classroom that the class teacher's seed opens in the school's active period. */
const SEEDED_COHORT = "X-1";
const SEEDED_CLASS = "Fisika X-1";

test("an admin adds, renames, archives and restores a classroom of a cohort, and a taken name is refused in words", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const seed = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(seed, school.slug, address("/")));
  await seed.close();
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/profile"));
  await page.getByRole("link", { exact: true, name: "Classrooms" }).click();
  await expect(page).toHaveURL(address("/settings/classes"));
  const header = page.locator("header");
  await expect(
    header.getByRole("textbox", { name: "Find a classroom" })
  ).toBeVisible();
  const add = header.getByRole("button", { name: "Add classroom" });
  await waitUntilTakenOver(add);
  await expect(add).toBeEnabled();
  await expect(
    page.getByRole("row", { name: SEEDED_CLASS }).getByText("Active")
  ).toBeVisible();

  await add.click();
  const addDialog = page.getByRole("dialog");
  await expect(
    addDialog.getByRole("button", { name: "Add classroom" })
  ).toBeDisabled();
  await addDialog.getByRole("combobox", { name: "Cohort" }).click();
  await page.getByRole("option", { exact: true, name: SEEDED_COHORT }).click();
  await addDialog.getByLabel("Subject").fill("Biologi");
  await addDialog.getByRole("button", { name: "Add classroom" }).click();
  const biology = page.getByRole("row", { name: "Biologi X-1" });
  await expect(biology.getByText("Active")).toBeVisible();

  await biology.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog");
  await renameDialog.getByLabel("Name").fill("Biologi Lanjut X-1");
  await renameDialog.getByRole("button", { name: "Save" }).click();
  const renamed = page.getByRole("row", { name: "Biologi Lanjut X-1" });
  await expect(renamed).toBeVisible();

  await renamed.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText("Classroom archived.")).toBeVisible();
  await expect(renamed.getByText("Archived")).toBeVisible();
  await renamed.getByRole("button", { name: "Restore" }).click();
  await expect(renamed.getByText("Active")).toBeVisible();

  // A second classroom of the same subject in the cohort takes the seeded name, so the server refuses it and the
  // toast says why, while the list keeps only the seeded classroom of that name.
  await add.click();
  await addDialog.getByRole("combobox", { name: "Cohort" }).click();
  await page.getByRole("option", { exact: true, name: SEEDED_COHORT }).click();
  await addDialog.getByLabel("Subject").fill("Fisika");
  await addDialog.getByRole("button", { name: "Add classroom" }).click();
  await expect(
    page.getByText("This classroom name is already used.")
  ).toBeVisible();
  await expect(page.getByRole("row", { name: SEEDED_CLASS })).toHaveCount(1);
  await context.close();
});
