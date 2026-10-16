import { expect, test } from "@playwright/test";
import { hostAddress } from "@/e2e/support/school";

/** A school address that no school holds, so the school host answers not found. */
const UNKNOWN_SCHOOL = "zz-unknown";

test("the school tree answers not found on the main host", async ({
  page,
  baseURL,
}) => {
  const response = await page.goto(new URL("/id/school/harapan", baseURL).href);

  expect(response?.status()).toBe(404);
});

test("an unknown school answers not found on its own host", async ({
  page,
  baseURL,
}) => {
  const response = await page.goto(
    hostAddress(baseURL, `${UNKNOWN_SCHOOL}.localhost`, "/")
  );

  expect(response?.status()).toBe(404);
});

test("a school path keeps its host and carries no locale, even for a visitor who prefers another language", async ({
  browser,
  baseURL,
}) => {
  const target = hostAddress(
    baseURL,
    `${UNKNOWN_SCHOOL}.localhost`,
    "/classes/fisika-x-1"
  );
  // Main-site routing would redirect this path to `/id/...` for this visitor,
  // so the unchanged address shows that the school rewrite answered it.
  const context = await browser.newContext({
    extraHTTPHeaders: { "Accept-Language": "id" },
  });
  const page = await context.newPage();
  await page.goto(target);

  expect(page.url()).toBe(target);
  await context.close();
});

test("the NEXT_LOCALE cookie chooses the language of a school host before Accept-Language", async ({
  browser,
  baseURL,
}) => {
  const schoolHost = hostAddress(baseURL, `${UNKNOWN_SCHOOL}.localhost`, "/");
  const context = await browser.newContext({
    extraHTTPHeaders: { "Accept-Language": "id" },
  });
  await context.addCookies([
    { name: "NEXT_LOCALE", url: schoolHost, value: "de" },
  ]);
  const page = await context.newPage();
  await page.goto(schoolHost);

  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await context.close();
});

test("Accept-Language chooses the language of a school host without a cookie", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "Accept-Language": "id" },
  });
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, `${UNKNOWN_SCHOOL}.localhost`, "/"));

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await context.close();
});
