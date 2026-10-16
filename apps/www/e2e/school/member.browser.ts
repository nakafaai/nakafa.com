import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import {
  createOwnerCookie,
  createSchool,
  hostAddress,
  signInOwner,
} from "@/e2e/support/school";

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

test("the session that the main site refreshes is the same session on the school host", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const cookie = await Effect.runPromise(createOwnerCookie(school.slug));
  const context = await browser.newContext();
  // The owner's cookie starts as the main site's own, on `localhost`.
  await context.addCookies([
    {
      httpOnly: true,
      name: cookie.name,
      sameSite: "Lax",
      url: hostAddress(baseURL, "localhost", "/"),
      value: cookie.value,
    },
  ]);
  const page = await context.newPage();

  // Each read of the session on the main site refreshes its cookie, and the
  // answer sets the shared cookie that the school host must accept.
  const session = await page.goto(
    hostAddress(baseURL, "localhost", "/api/auth/get-session")
  );
  expect(session?.status()).toBe(200);
  expect(await session?.text()).toContain('"user"');

  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await expect(page.getByText("You are signed in as Owner.")).toBeVisible();
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
