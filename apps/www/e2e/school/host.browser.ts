import { expect, test } from "@playwright/test";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { createSchool, hostAddress } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

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
  // The Worker answers the unknown school with the app's not-found page at the
  // school's own address, and the browser takes over the page that the server
  // sent: a page drawn for another address would fail hydration (React #418).
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.promise(async () => {
        const response = await page.goto(
          hostAddress(baseURL, `${UNKNOWN_SCHOOL}.localhost`, "/")
        );
        expect(response?.status()).toBe(404);
        // The first HTML holds the page, so nothing paints blank before React.
        expect(await response?.text()).toContain("find this page");
        const home = page.getByRole("link", { exact: true, name: "Go home" });
        await waitUntilTakenOver(home);
        await expect(home).toHaveAttribute(
          "href",
          new URL("/en", SITE_ORIGIN).href
        );
      })
    )
  );
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
