import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

test("a member sees the school in the sidebar and the viewer's role in Beranda", async ({
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
  await expect(page.getByText("You are signed in as Owner.")).toBeVisible();
  await expect(page.getByText(school.name, { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
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

  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Indonesia" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByText("Kamu masuk sebagai Pemilik.")).toBeVisible();
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
  await expect(page.getByText("You are signed in as Owner.")).toBeVisible();
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
