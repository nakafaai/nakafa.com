import { expect, type Locator, test } from "@playwright/test";
import { MutableList } from "effect";
import { recordServerFunctionCalls } from "@/e2e/support/requests";

const HOME = "/en";
const SIGN_IN = "/en/auth";
/** The sign-in page's title, in English. */
const TITLE = "Sign in to Nakafa";
/** The longest a press may take to show the sign-in title, in milliseconds. */
const PRESS_TO_TITLE_BUDGET = 200;

/**
 * Waits until React has hydrated a link, so a press runs the router. A press
 * before hydration is the browser's own document load.
 */
function hydrated(link: Locator) {
  return expect
    .poll(() =>
      link.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);
}

/**
 * The sign-in page is prerendered, and the build keeps the answer of each of its
 * loaders as a static file. A visitor's press on the header's Try Nakafa stays in
 * the document and reads only those answers, preloaded when the pointer reaches
 * the link, so the page shows at once and no request reaches a server function.
 */
test("a visitor's press on Try Nakafa shows the sign-in page from static answers", async ({
  page,
}) => {
  const serverFunctionCalls = recordServerFunctionCalls(page);
  const staticAnswerRequests = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.url().includes("/_data/")) {
      MutableList.append(staticAnswerRequests, request.url());
    }
  });

  await page.goto(HOME);
  const tryNakafa = page.locator(`header a[href="${SIGN_IN}"]`).first();
  await expect(tryNakafa).toBeVisible();
  await hydrated(tryNakafa);
  // A document load starts a new document, which drops this mark. A client
  // navigation keeps the document, and so keeps the mark.
  await page.evaluate(() => Reflect.set(document, "nakafaDocumentMark", true));
  await tryNakafa.hover();
  await page.waitForLoadState("networkidle");

  const pressedAt = await page.evaluate(() => performance.now());
  await tryNakafa.click();
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  const shownAt = await page.evaluate(() => performance.now());

  await expect(page).toHaveURL(new RegExp(`${SIGN_IN}$`));
  expect(
    await page.evaluate(() => Reflect.get(document, "nakafaDocumentMark"))
  ).toBe(true);
  expect(MutableList.toArray(serverFunctionCalls)).toEqual([]);
  expect(MutableList.toArray(staticAnswerRequests).length).toBeGreaterThan(0);
  expect(shownAt - pressedAt).toBeLessThan(PRESS_TO_TITLE_BUDGET);
});

/**
 * A visitor who opens the sign-in address gets the prerendered page from the
 * static assets, which carry an entity tag, and no Worker render, which carries
 * none. The intent in the query string changes nothing about the page.
 */
test("opening the sign-in address answers a visitor with the prerendered page", async ({
  page,
}) => {
  const response = await page.request.get(
    `${SIGN_IN}?${new URLSearchParams({ redirect: "/en/pricing" })}`,
    { maxRedirects: 0 }
  );

  expect(response.status()).toBe(200);
  expect(response.headers().etag).toBeTruthy();
  expect(await response.text()).toContain(TITLE);
});
