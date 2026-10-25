import { expect, test } from "@playwright/test";
import { MutableList } from "effect";

/**
 * A public article is a prerendered page, so moving from one article to another is
 * a document load. The browser fetches the second page's HTML from the static
 * assets, and no client loader calls a server function for the public content.
 */
test("moving between two articles loads documents and sends no server function request", async ({
  page,
}) => {
  const serverFunctionRequests = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.url().includes("/_serverFn/")) {
      MutableList.append(serverFunctionRequests, request.url());
    }
  });

  await page.goto("/en/articles");
  const firstArticle = page.locator('a[href^="/en/articles/"]').first();
  await firstArticle.waitFor();
  const firstHref = await firstArticle.getAttribute("href");
  expect(firstHref).toBeTruthy();

  const firstDocument = page.waitForEvent("framenavigated");
  await firstArticle.click();
  await firstDocument;
  await expect(page).toHaveURL(new RegExp(`${firstHref ?? ""}$`));

  const secondArticle = page
    .locator(`a[href^="/en/articles/"]:not([href="${firstHref ?? ""}"])`)
    .first();
  await secondArticle.waitFor();
  const secondHref = await secondArticle.getAttribute("href");
  const navigations = await page.evaluate(
    () => performance.getEntriesByType("navigation").length
  );

  await secondArticle.click();
  await expect(page).toHaveURL(new RegExp(`${secondHref ?? ""}$`));
  const navigationsAfter = await page.evaluate(
    () => performance.getEntriesByType("navigation").length
  );

  expect(navigationsAfter).toBeGreaterThan(navigations);
  expect(MutableList.toArray(serverFunctionRequests)).toEqual([]);
});
