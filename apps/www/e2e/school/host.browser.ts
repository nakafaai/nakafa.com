import { expect, test } from "@playwright/test";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect } from "effect";
import { createSchool, hostAddress } from "../support/school";

/**
 * The address where the app's standalone not-found page answers, and the
 * request header in which the proxy names its language, as e2e/state/missing
 * explains.
 */
const STANDALONE_ADDRESS = "/_not-found";
const LOCALE_HEADER = "x-nakafa-locale";

/** A school address that no school holds, so the school host answers not found. */
const UNKNOWN_SCHOOL = "zz-unknown";

/**
 * A visitor whose browser prefers Indonesian. Playwright sets the Accept-Language
 * header of the page request from the context `locale`, which replaces an
 * Accept-Language given in `extraHTTPHeaders` for that request, so the locale is
 * set through the context.
 */
const INDONESIAN_VISITOR = { locale: "id-ID" };

test("the school tree answers not found on the main host", async ({
  page,
  baseURL,
}) => {
  const response = await page.goto(new URL("/id/school/harapan", baseURL).href);

  expect(response?.status()).toBe(404);
});

test("a school path without a locale answers not found on the main host", async ({
  page,
  baseURL,
}) => {
  const response = await page.goto(new URL("/school/harapan", baseURL).href);

  expect(response?.status()).toBe(404);
});

test("an encoded school path answers not found on the main host, even to a Flight request", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const context = await browser.newContext();

  const response = await context.request.get(
    new URL(`/id/%73chool/${school.slug}`, baseURL).href,
    { headers: { RSC: "1" } }
  );

  expect(response.status()).toBe(404);
  await context.close();
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

test("the not-found page of an unknown school links to Nakafa, because the school's own home is not found too", async ({
  page,
  baseURL,
}) => {
  // The proxy rewrites the unknown school to the standalone not-found page.
  // On Vercel the rewrite reaches the app's page; a local production build
  // draws the app's page only at its own address and answers the rewrite with
  // the framework's built-in page. So the page is opened at its address on the
  // school host, with the language header the proxy sets.
  await page.setExtraHTTPHeaders({ [LOCALE_HEADER]: "en" });
  await page.goto(
    hostAddress(baseURL, `${UNKNOWN_SCHOOL}.localhost`, STANDALONE_ADDRESS)
  );

  await expect(
    page.getByRole("link", { exact: true, name: "Go home" })
  ).toHaveAttribute("href", new URL("/en", SITE_ORIGIN).href);
});

test("a school root keeps its address with no locale prefix, even for a visitor who prefers another language", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext(INDONESIAN_VISITOR);
  const page = await context.newPage();

  await page.goto(schoolHome);

  expect(page.url()).toBe(schoolHome);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await context.close();
});

test("the NAKAFA_LOCALE cookie chooses the language of a school host before Accept-Language", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const schoolHome = hostAddress(baseURL, `${school.slug}.localhost`, "/");
  const context = await browser.newContext(INDONESIAN_VISITOR);
  await context.addCookies([
    { name: "NAKAFA_LOCALE", url: schoolHome, value: "de" },
  ]);
  const page = await context.newPage();

  await page.goto(schoolHome);

  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: `Anmelden bei ${school.name}` })
  ).toBeVisible();
  await context.close();
});

test("Accept-Language chooses the language of a school host without a cookie", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const context = await browser.newContext(INDONESIAN_VISITOR);
  const page = await context.newPage();

  await page.goto(hostAddress(baseURL, `${school.slug}.localhost`, "/"));

  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${school.name}` })
  ).toBeVisible();
  await context.close();
});
