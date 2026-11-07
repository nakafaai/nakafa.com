import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { expectNoSidewaysSidebar } from "@/e2e/support/sidebar";
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
  await expect(sidebar.getByRole("link", { name: "Exams" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(sidebar.getByText("Classes", { exact: true })).toHaveCount(0);
  await context.close();
});

test("the settings sidebar stands the profile and billing alone with their icons, and folds every other group under its name, open while it holds the page", async ({
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
  for (const alone of ["Profile", "Billing"]) {
    const link = sidebar.getByRole("link", { exact: true, name: alone });
    await expect(link).toBeVisible();
    await expect(link.locator("svg")).toHaveCount(1);
  }
  // Every other group folds under its own name and icon, and none holds the profile, so each stays shut.
  for (const group of ["Academics", "People", "Integrations", "Security"]) {
    const fold = sidebar.getByRole("button", { exact: true, name: group });
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await expect(fold.locator("svg")).toHaveCount(2);
  }
  const members = sidebar.getByRole("link", { exact: true, name: "Members" });
  await expect(members).toBeHidden();
  const people = sidebar.getByRole("button", { exact: true, name: "People" });
  await waitUntilTakenOver(people);
  await people.click();
  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(members).toBeVisible();
  // A section folded under its group reads by its name alone.
  await expect(members.locator("svg")).toHaveCount(0);
  const before = await members.boundingBox();
  await members.click();

  await expect(page).toHaveURL(address("/settings/members"));
  await expect(members).toHaveAttribute("data-active", "true");
  // The open group stays open, so Members keeps its place under the pointer.
  await expect(people).toHaveAttribute("aria-expanded", "true");
  expect((await members.boundingBox())?.y).toBe(before?.y);

  // A hard load opens the group that holds the page, and only that one.
  await page.reload();
  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(members).toHaveAttribute("data-active", "true");
  await expect(
    sidebar.getByRole("button", { exact: true, name: "Academics" })
  ).toHaveAttribute("aria-expanded", "false");
  await context.close();
});

test("no two entries of the settings sidebar draw the same icon", async ({
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
  // The school's own groups stay mounted, hidden, behind the settings, so that coming back draws them at once.
  const entries = sidebar
    .locator('[data-sidebar="menu-button"]')
    .filter({ visible: true });
  await expect(
    sidebar.getByRole("button", { name: "Security", exact: true })
  ).toBeVisible();

  // Each entry's first icon is its own: the way back, the profile and billing, then every group.
  const icons = await entries.evaluateAll((nodes) =>
    nodes.map((node) => node.querySelector("svg")?.innerHTML ?? "")
  );
  expect(icons.length).toBeGreaterThan(4);
  expect(Arr.dedupe(icons)).toEqual(icons);
  await context.close();
});

test("the settings sidebar keeps every part inside its own width at 320, 390, 768, 1024 and 1440 px, open and folded", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  // The settings hold the most groups, whose names fold away under the icons in the rail.
  await Effect.runPromise(
    expectNoSidewaysSidebar(page, address("/settings/profile"))
  );
  await context.close();
});
