import { expect, test } from "@playwright/test";

/**
 * A sitemap id whose partition the release never published. No file of the build
 * has that address, so the static not-found page answers it, and the answer is
 * marked noindex.
 */
const MISSING_PARTITION = "/sitemap/material_en_p999.xml";

test("a sitemap page past the last partition answers the static not-found page", async ({
  request,
}) => {
  const response = await request.get(MISSING_PARTITION);

  expect(response.status()).toBe(404);
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
  expect(await response.text()).toContain("Page not found");
});
