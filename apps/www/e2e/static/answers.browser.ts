import { expect, test } from "@playwright/test";
import { MutableList } from "effect";

/** The longest a press may take to show the next article's heading, in milliseconds. */
const PRESS_TO_HEADING_BUDGET = 200;

/**
 * A public article is a prerendered page, and the build keeps the answer of each of
 * its loaders as a static file. Moving from one article to another stays in the
 * same document: the router reads the next article's answers from the static
 * assets, preloaded when the reader points at the link, and no request reaches a
 * server function.
 */
test("moving between two articles stays in the document and reads only static answers", async ({
  page,
}) => {
  const serverFunctionRequests = MutableList.make<string>();
  const staticAnswerRequests = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.url().includes("/_serverFn/")) {
      MutableList.append(serverFunctionRequests, request.url());
    }
    if (request.url().includes("/_data/")) {
      MutableList.append(staticAnswerRequests, request.url());
    }
  });

  await page.goto("/en/articles");
  const firstArticle = page.locator('a[href^="/en/articles/"]').first();
  await firstArticle.waitFor();
  const firstHref = await firstArticle.getAttribute("href");
  expect(firstHref).toBeTruthy();

  // A document load starts a new document, which drops this mark. A client
  // navigation keeps the document, and so keeps the mark.
  await page.evaluate(() => Reflect.set(document, "nakafaDocumentMark", true));
  await firstArticle.click();
  await expect(page).toHaveURL(new RegExp(`${firstHref ?? ""}$`));
  await expect(page.locator("h1").first()).toBeVisible();

  const secondArticle = page
    .locator(`a[href^="/en/articles/"]:not([href="${firstHref ?? ""}"])`)
    .first();
  await secondArticle.waitFor();
  const secondHref = await secondArticle.getAttribute("href");
  const firstHeading = await page.locator("h1").first().textContent();

  // Pointing at the link preloads the next article, as a reader's hover does.
  const preloaded = page.waitForResponse((response) =>
    response.url().includes("/_data/")
  );
  await secondArticle.hover();
  await preloaded;

  const pressedAt = await page.evaluate(() => performance.now());
  await secondArticle.click();
  await expect(page.locator("h1").first()).not.toHaveText(firstHeading ?? "");
  const shownAt = await page.evaluate(() => performance.now());

  await expect(page).toHaveURL(new RegExp(`${secondHref ?? ""}$`));
  expect(
    await page.evaluate(() => Reflect.get(document, "nakafaDocumentMark"))
  ).toBe(true);
  expect(MutableList.toArray(serverFunctionRequests)).toEqual([]);
  expect(MutableList.toArray(staticAnswerRequests).length).toBeGreaterThan(0);
  expect(shownAt - pressedAt).toBeLessThan(PRESS_TO_HEADING_BUDGET);
});
