import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readFormProblems } from "@/e2e/support/form";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

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
  await page.waitForURL(EDITOR_PATH);

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

for (const viewport of [
  { height: 900, name: "dialog", width: 1440 },
  { height: 844, name: "drawer", width: 390 },
]) {
  test(`a form in a ${viewport.name} reads by its gaps, and keeps its edges`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();
    await page.goto(hostAddress(baseURL, host, "/settings/invites"));
    const invite = page.getByRole("button", { name: "Invite" }).first();
    await waitUntilTakenOver(invite);
    await invite.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect.poll(() => readFormProblems(page)).toEqual([]);
    await context.close();
  });
}
