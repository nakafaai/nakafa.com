import { expect, test } from "@playwright/test";
import { SITE_ORIGIN } from "@repo/seo/origin";
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
  await expect(page.locator('svg[width="190"]')).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Theme" })
  ).toBeVisible();
  const terms = page.getByRole("link", {
    exact: true,
    name: "Terms of Service",
  });
  await expect(terms).toHaveAttribute(
    "href",
    new URL("/en/terms-of-service", SITE_ORIGIN).href
  );
  await expect(terms).toHaveAttribute("target", "_blank");
  const privacy = page.getByRole("link", {
    exact: true,
    name: "Privacy Policy",
  });
  await expect(privacy).toHaveAttribute(
    "href",
    new URL("/en/privacy-policy", SITE_ORIGIN).href
  );
  await expect(privacy).toHaveAttribute("target", "_blank");
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
