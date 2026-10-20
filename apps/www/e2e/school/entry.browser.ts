import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { expectSignInParts } from "../support/auth";
import { createSchool, hostAddress } from "../support/school";

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
  // The school's own mark stands above the title: its animal, since it has no logo yet.
  await expect(
    page.locator('main [data-slot="avatar-fallback"]').first()
  ).toBeVisible();
  await Effect.runPromise(expectSignInParts(page));
});
