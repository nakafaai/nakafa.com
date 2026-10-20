import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** The Google sign-in action of the school entry, which the username address keeps on screen. */
const GOOGLE_ACTION = /Google/;

/**
 * The first screens of the school pages are in the first HTML, so a member's page
 * draws its data with JavaScript off, and the live reads start after hydration.
 * Each test signs the owner in with JavaScript on, then reads the page again in a
 * context with JavaScript off that keeps the same cookies.
 */
test("the school home's first HTML holds the home for a member", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const withoutScript = await browser.newContext({ javaScriptEnabled: false });
  await withoutScript.addCookies(await context.cookies());
  const page = await withoutScript.newPage();

  const response = await page.goto(schoolHome);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await context.close();
  await withoutScript.close();
});

test("the exam list's first HTML holds the exams of a member who may open them", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const examsPage = hostAddress(baseURL, `${school.slug}.localhost`, "/exams");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, examsPage));
  const withoutScript = await browser.newContext({ javaScriptEnabled: false });
  await withoutScript.addCookies(await context.cookies());
  const page = await withoutScript.newPage();

  const response = await page.goto(examsPage);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.close();
  await withoutScript.close();
});

test("the settings units tab's first HTML holds the school's units", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const unitsPage = hostAddress(
    baseURL,
    `${school.slug}.localhost`,
    "/settings/units"
  );
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, unitsPage));
  const withoutScript = await browser.newContext({ javaScriptEnabled: false });
  await withoutScript.addCookies(await context.cookies());
  const page = await withoutScript.newPage();

  const response = await page.goto(unitsPage);

  expect(response?.status()).toBe(200);
  await expect(page.getByText(school.name, { exact: true })).toHaveCount(1);
  await context.close();
  await withoutScript.close();
});

test("an exam address that is not an id answers not found for every viewer", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const context = await browser.newContext();
  const address = hostAddress(
    baseURL,
    `${school.slug}.localhost`,
    "/exams/not-an-exam"
  );

  const response = await context.request.get(address);

  expect(response.status()).toBe(404);
  await context.close();
});

test("the username address of the entry opens the form from the route's search", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(
    hostAddress(baseURL, `${school.slug}.localhost`, "/?masuk=username")
  );

  await expect(page.getByRole("button", { name: GOOGLE_ACTION })).toBeVisible();
  await context.close();
});
