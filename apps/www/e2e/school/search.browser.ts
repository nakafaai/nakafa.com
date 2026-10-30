import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The palette, named by its title. */
const PALETTE = { name: "Search" } as const;
/** The rows of the palette that the owner's test reads, each named first by its place. */
const HOME_ROW = /^Home/;
const AUDIT_ROW = /^Audit trail/;
const MEMBERS_ROW = /^Members/;

test("the owner's search finds a setting by its name and opens it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  await page.goto(address("/"));

  const search = page
    .locator('[data-slot="sidebar-header"]')
    .getByRole("button", { name: "Search the school..." });
  await waitUntilTakenOver(search);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", PALETTE);
  await expect(palette).toBeVisible();
  // Before a query every place the owner may open is listed, the settings included.
  await expect(palette.getByRole("option", { name: HOME_ROW })).toBeVisible();
  await expect(palette.getByRole("option", { name: AUDIT_ROW })).toHaveCount(1);

  await palette.getByRole("combobox").fill("memb");
  const members = palette.getByRole("option", { name: MEMBERS_ROW });
  // A section of the settings names the group it lives in.
  await expect(members).toContainText("People");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(address("/settings/members"));
  await expect(palette).toBeHidden();
  await context.close();
});

test("a class teacher's search lists the teacher's class and no settings", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/"));

  const search = page
    .locator('[data-slot="sidebar-header"]')
    .getByRole("button", { name: "Search the school..." });
  await waitUntilTakenOver(search);
  await search.click();
  const palette = page.getByRole("dialog", PALETTE);
  await expect(palette).toBeVisible();
  await expect(
    palette.getByRole("option", { name: "Fisika X-1", exact: true })
  ).toBeVisible();
  await expect(palette.getByText("Settings", { exact: true })).toHaveCount(0);

  await palette
    .getByRole("option", { name: "Fisika X-1", exact: true })
    .click();
  await expect(page).toHaveURL(address("/classes/fisika-x-1"));
  await context.close();
});
