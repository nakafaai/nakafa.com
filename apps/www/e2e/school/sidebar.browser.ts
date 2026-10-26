import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("a school without a logo shows its animal beside its name, and its account menu lists its items", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  const header = page.locator('[data-slot="sidebar-header"]');
  await expect(header.getByText(school.name, { exact: true })).toBeVisible();
  await expect(header.locator('[data-slot="avatar-fallback"]')).toBeVisible();
  await expect(header.locator("img")).toHaveCount(0);

  await waitUntilTakenOver(
    page.getByRole("button", { name: "Acceptance Owner" })
  );
  await page.getByRole("button", { name: "Acceptance Owner" }).click();

  for (const item of [
    "Account settings",
    "Theme",
    "Language",
    "Back to Nakafa",
    "Logout",
  ]) {
    await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  }
  await context.close();
});

test("a teacher of a class in the active period sees the class under Classes, and opening it marks the entry as the current page", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInClassTeacher(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  await expect(sidebar.getByText("Classes", { exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "Fisika X-1", exact: true }).click();

  await expect(page).toHaveURL(
    hostAddress(baseURL, `${school.slug}.localhost`, "/classes/fisika-x-1")
  );
  await expect(
    sidebar.getByRole("link", { name: "Fisika X-1", exact: true })
  ).toHaveAttribute("data-active", "true");
  await context.close();
});

test("a member with no class sees no Classes group in the sidebar", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  await expect(sidebar.getByRole("link", { name: "Home" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(sidebar.getByText("Classes", { exact: true })).toHaveCount(0);
  await context.close();
});

test("a settings group stays open when the viewer opens a section of another group, so the sidebar does not move under the pointer", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/profile"));

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  const profile = sidebar.getByRole("link", { name: "Profile", exact: true });
  await expect(profile).toBeVisible();
  await waitUntilTakenOver(sidebar.getByRole("button", { name: "People" }));
  await sidebar.getByRole("button", { name: "People" }).click();
  const members = sidebar.getByRole("link", { name: "Members", exact: true });
  // Every settings item carries its icon beside its name.
  await expect(members.locator("svg")).toHaveCount(1);
  await expect(profile.locator("svg")).toHaveCount(1);
  const before = await members.boundingBox();
  await members.click();

  await expect(page).toHaveURL(address("/settings/members"));
  await expect(members).toHaveAttribute("data-active", "true");
  // The School group the viewer came from stays open, so Members keeps its place.
  await expect(profile).toBeVisible();
  expect((await members.boundingBox())?.y).toBe(before?.y);
  await context.close();
});

test("no two entries of the settings sidebar draw the same icon, a group and its sections included", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/settings/profile"));

  const sidebar = page.locator('[data-slot="sidebar-content"]');
  await waitUntilTakenOver(sidebar.getByRole("button", { name: "People" }));
  for (const group of ["People", "Integrations", "Security"]) {
    await sidebar.getByRole("button", { name: group }).click();
  }
  // A group's button is the trigger of its fold, so it keeps the sidebar's own mark, not its slot.
  const entries = sidebar.locator(
    '[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]'
  );
  await expect(
    sidebar.getByRole("link", { name: "Audit trail", exact: true })
  ).toBeVisible();

  // Each entry's first icon is its own; the fold arrow after a group's name is not an entry's icon.
  const icons = await entries.evaluateAll((nodes) =>
    nodes.map((node) => node.querySelector("svg")?.innerHTML ?? "")
  );
  // The groups' own buttons are among the entries compared, beside every section's link.
  expect(icons.length).toBeGreaterThan(
    await sidebar.locator('[data-sidebar="menu-sub-button"]').count()
  );
  expect(Arr.dedupe(icons)).toEqual(icons);
  await context.close();
});
