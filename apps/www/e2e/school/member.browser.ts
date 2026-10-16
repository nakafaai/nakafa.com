import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createOwnerCookie,
  createSchool,
  hostAddress,
  signInOwner,
} from "@/e2e/support/school";

test("a member sees the school with the viewer's role in it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();

  const response = await page.goto(schoolHome);

  expect(response?.status()).toBe(200);
  await expect(
    page.getByText(`You are signed in as Owner at ${school.name}.`)
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await context.close();
});

test("a session of the main site's domain is the same session on the school host", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const cookie = await Effect.runPromise(createOwnerCookie(school.slug));
  const context = await browser.newContext();
  // The main site's cookie carries the domain `localhost`, so the browser
  // sends it to every `*.localhost` school host, as it does in production.
  await context.addCookies([
    {
      domain: "localhost",
      httpOnly: true,
      name: cookie.name,
      path: "/",
      sameSite: "Lax",
      value: cookie.value,
    },
  ]);
  const page = await context.newPage();

  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await expect(
    page.getByText(`You are signed in as Owner at ${school.name}.`)
  ).toBeVisible();
  await context.close();
});

test("the account menu saves the language of the school host and renders the school in it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Indonesia" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(
    page.getByText(`Kamu masuk sebagai Pemilik di ${school.name}.`)
  ).toBeVisible();
  expect(await context.cookies(schoolHome)).toContainEqual(
    expect.objectContaining({ name: "NEXT_LOCALE", value: "id" })
  );
  await context.close();
});

test("the school shell does not move the page while it loads", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();

  await page.goto(schoolHome);
  await expect(
    page.getByText(`You are signed in as Owner at ${school.name}.`)
  ).toBeVisible();
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});
