import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  signInOwner,
} from "@/e2e/support/school";

test("a member sees the school in the sidebar and the page's one action in Beranda", async ({
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
  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await expect(page.getByText(school.name, { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await context.close();
});

test("Beranda offers the owner one next step, which opens the exams", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const schoolHome = hostAddress(baseURL, host, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();
  await page.goto(schoolHome);

  await expect(
    page.getByText("Students see an exam only once it is scheduled.")
  ).toBeVisible();
  await page.getByRole("link", { name: "Open exams" }).click();
  await expect(page).toHaveURL(hostAddress(baseURL, host, "/exams"));
  await context.close();
});

test("Beranda offers no next step to a member who may not open exams", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(
    inviteLearner({
      address: `member-${school.slug}@acceptance.example.test`,
      baseURL: schoolHome,
      context,
      slug: school.slug,
    })
  );
  const page = await context.newPage();
  await page.goto(schoolHome);

  // The header and the step read the same viewer, so once the header shows, a step would too.
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open exams" })).toHaveCount(0);
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
  // The language changes in place, so a value set on this document survives it.
  await page.evaluate(() => Reflect.set(window, "nakafaSameDocument", true));

  await page.getByRole("button", { name: "Acceptance Owner" }).click();
  await page.getByRole("menuitem", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Indonesia" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("button", { name: "Buat ujian" })).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "nakafaSameDocument"))
  ).toBe(true);
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
  await expect(page.getByRole("button", { name: "Create exam" })).toBeVisible();
  await page.waitForLoadState("load");

  expect(await Effect.runPromise(readCumulativeLayoutShift(page))).toBe(0);
  await context.close();
});

test("an address below a school that no page answers shows the school's not-found page, with a way back to the school", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, schoolHome));
  const page = await context.newPage();

  await page.goto(
    hostAddress(baseURL, `${school.slug}.localhost`, "/classes/fisika")
  );

  await expect(
    page.getByRole("heading", { level: 1, name: "We can't find this page" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Go home" })
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("link", { name: "Search materials" })
  ).toHaveCount(0);
  await context.close();
});
