import { expect, test } from "@playwright/test";

/**
 * A canonical sitemap id whose partition was never published. The page read
 * runs inside the origin cache, so this proves a missing page still reaches
 * the route as a missing page and not as a failed read.
 */
const MISSING_PARTITION = "/sitemap/material_en_p999.xml";

test("a sitemap page past the last partition answers not found", async ({
  request,
}) => {
  const response = await request.get(MISSING_PARTITION);

  expect(response.status()).toBe(404);
  expect(await response.text()).toBe("Not found");
});
