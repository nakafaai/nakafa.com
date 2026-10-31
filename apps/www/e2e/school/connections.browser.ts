import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** A message key drawn as text, which a page shows when its namespace is not loaded. */
const RAW_KEY = /^Connectors\./u;

test("the owner's Settings > Connections names the school's Google connector in words, never by its message key", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/connections"));
  // The acceptance deployment offers Drive, Calendar and Classroom. Drive and Calendar belong to a person's own
  // account settings, so the school's page draws only the Classroom card, which offers Connect.
  await expect(
    page.getByText("Google Classroom", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect" })).toHaveCount(1);
  await expect(page.getByText(RAW_KEY)).toHaveCount(0);
  await context.close();
});
