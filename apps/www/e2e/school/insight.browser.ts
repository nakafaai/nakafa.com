import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("a teacher picks a class to read, and a student reads only their own standing", async ({
  baseURL,
  browser,
}, testInfo) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);

  const owner = await browser.newContext();
  await Effect.runPromise(signInOwner(owner, school.slug, address("/")));
  const staff = await owner.newPage();
  await staff.goto(address("/insight"));
  await waitUntilTakenOver(staff.getByRole("combobox", { name: "Class" }));
  await expect(staff.getByText("Pick a class")).toBeVisible();
  await owner.close();

  const learner = `raka-${testInfo.testId.slice(0, 6)}@example.com`;
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context,
      slug: school.slug,
    })
  );
  await Effect.runPromise(grantStudent(school.slug, learner));
  const page = await context.newPage();
  await page.goto(address("/insight"));
  await expect(page.getByText("Nothing to show yet")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Class" })).toHaveCount(0);
  await context.close();
});
