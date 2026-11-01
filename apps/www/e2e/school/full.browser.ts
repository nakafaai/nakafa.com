import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  fillSchool,
  hostAddress,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A guardian the seed names far past the first page of every list. */
const FAR_PERSON = "Galih Handayani";

/** The address of the Parents page, which Escape leaves alone while a row is open. */
const PARENTS_PATH = /\/settings\/guardians$/u;

/** How long the seed may take, and a list may take to read a whole school. */
const FULL_MILLISECONDS = 600_000;
const EVERY_ROW_MILLISECONDS = 120_000;

test("a full school's lists answer a search, a filter, a sort and Escape", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(FULL_MILLISECONDS);
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  await Effect.runPromise(fillSchool(school.slug));
  const page = await context.newPage();

  // A search reaches a person past every page, and the table stays on the screen while it reads.
  await page.goto(address("/settings/members"));
  await expect(page.locator("tbody tr").first()).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.getByRole("textbox", { name: "Find a name" }).fill(FAR_PERSON);
  await expect(page.getByRole("cell", { name: FAR_PERSON })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  // A role's filter offers every role, not only those of the rows loaded so far.
  await page.getByRole("textbox", { name: "Find a name" }).fill("");
  await page.getByRole("button", { name: "Filter by Roles" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Teacher" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.locator("tbody tr").filter({ hasText: "Teacher" }).first()
  ).toBeVisible({ timeout: EVERY_ROW_MILLISECONDS });

  // A sort reads every row first, so the last title of the school stands at the top.
  await page.goto(address("/exams"));
  const title = page.getByRole("button", { name: "Exam title" });
  await waitUntilTakenOver(title);
  await title.click();
  await page.getByRole("button", { name: "Z-A" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("tbody tr").first()).toContainText("Matematika", {
    timeout: EVERY_ROW_MILLISECONDS,
  });

  // Escape closes an open row before it leaves Settings.
  await page.goto(address("/settings/guardians"));
  const first = page.locator("tbody tr").first().getByRole("button").first();
  await waitUntilTakenOver(first);
  await first.click();
  await expect(page.locator("[data-pane-row]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-pane-row]")).toHaveCount(0);
  await expect(page).toHaveURL(PARENTS_PATH);
  await context.close();
});
