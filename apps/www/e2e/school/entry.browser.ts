import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { createSchool, hostAddress } from "@/e2e/support/school";

test("a signed-out visitor sees the sign-in surface of an existing school", async ({
  page,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const response = await page.goto(
    hostAddress(baseURL, `${school.slug}.localhost`, "/")
  );

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: `Sign in to ${school.name}` })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeVisible();
});

test("a learner who is not a member of an existing school gets not found", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, schoolHome));
  const page = await context.newPage();

  const response = await page.goto(schoolHome);

  // The page the 404 shows is checked at its own address in host.browser.ts:
  // a local production build answers the proxy's rewrite with the framework's
  // built-in page.
  expect(response?.status()).toBe(404);
  await context.close();
});
