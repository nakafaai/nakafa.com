import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  seedSitting,
  signInOwner,
} from "@/e2e/support/school";

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
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const learner = `student-${school.slug}@acceptance.example.test`;
  const learnerContext = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: learner,
      baseURL: address("/"),
      context: learnerContext,
      slug: school.slug,
    })
  );
  await learnerContext.close();
  // The seed records its exam as made by the school's Owner, who must have signed in first.
  const ownerContext = await browser.newContext();
  await Effect.runPromise(signInOwner(ownerContext, school.slug, address("/")));
  const sitting = await Effect.runPromise(seedSitting(school.slug, learner));
  await ownerContext.close();

  const examsPage = address("/exams");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, examsPage));
  const withoutScript = await browser.newContext({ javaScriptEnabled: false });
  await withoutScript.addCookies(await context.cookies());
  const page = await withoutScript.newPage();

  const response = await page.goto(examsPage);

  expect(response?.status()).toBe(200);
  await expect(page.getByText(sitting.title, { exact: true })).toBeVisible();
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
  await expect(
    page.getByText(`SMA ${school.name}`, { exact: true })
  ).toHaveCount(1);
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

  const visitor = await context.request.get(address);
  expect(visitor.status()).toBe(404);

  await Effect.runPromise(signInOwner(context, school.slug, address));
  const member = await context.request.get(address);
  expect(member.status()).toBe(404);
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

  await expect(page.getByLabel("School username")).toBeVisible();
  await context.close();
});
