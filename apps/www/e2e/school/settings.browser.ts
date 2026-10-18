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
  await expect(page.getByText(`${school.slug}.nakafa.com`)).toBeVisible();

  await page.getByRole("link", { name: "Periods" }).click();
  await expect(page).toHaveURL(address("/settings/periods"));
  await expect(page.getByRole("button", { name: "Add period" })).toBeVisible();
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
