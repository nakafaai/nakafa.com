import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInOwner,
  signInTeacher,
} from "@/e2e/support/school";

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
  await page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL(address("/"));
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
