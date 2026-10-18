import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { createSchool, hostAddress } from "@/e2e/support/school";

test("a wrong card code is refused with one message that does not say whether the username exists", async ({
  page,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await page.getByRole("button", { name: "Sign in with a username" }).click();
  await page.getByLabel("School username").fill("guru.tidak");
  await page.getByLabel("Card code").fill("ABCDE-FGHJK");
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "The username or card code is not right."
  );
});

test("a signed-in learner who is not a member of an existing school sees the outsider page", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, schoolHome));
  const page = await context.newPage();

  const response = await page.goto(schoolHome);

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Not a member" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch account" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with a card" })
  ).toBeVisible();
  await context.close();
});
