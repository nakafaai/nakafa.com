import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("the exam import offers a Google Form where the deployment offers Drive", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Fisika");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(/\/exams\/[^/]+\/edit$/u);

  const header = page.locator("header").filter({
    has: page.getByRole("button", { name: "More actions" }),
  });
  await header.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
  const importing = page.getByRole("dialog");
  await expect(importing.getByLabel("Questions from a file")).toBeAttached();
  await expect(
    importing.getByRole("button", { name: "From Google Forms" })
  ).toBeVisible();
  await context.close();
});
