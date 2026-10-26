import { expect, test } from "@playwright/test";
import { Array as Arr, Schema } from "effect";

/** When the page first painted content, and when each of its scripts started to download. */
const PaintOrder = Schema.Struct({
  firstContentfulPaint: Schema.Finite,
  scriptStarts: Schema.Array(Schema.Finite),
});

/**
 * A prerendered page holds its whole content in its HTML, so the build moves its
 * module preloads and its entry script into a loader that starts them once the
 * page has painted. The page paints before a single script downloads, then it
 * hydrates as before: a link runs the router.
 */
test("a prerendered page paints before it fetches a script, then hydrates", async ({
  page,
}) => {
  await page.goto("/en");
  const link = page.locator("header a").first();
  await expect
    .poll(() =>
      link.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);

  const order = Schema.decodeSync(PaintOrder)(
    await page.evaluate(() => ({
      firstContentfulPaint:
        performance
          .getEntriesByType("paint")
          .find((entry) => entry.name === "first-contentful-paint")
          ?.startTime ?? Number.NaN,
      scriptStarts: performance
        .getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).pathname.endsWith(".js"))
        .map((entry) => entry.startTime),
    }))
  );

  expect(order.scriptStarts.length).toBeGreaterThan(0);
  expect(
    Arr.every(order.scriptStarts, (start) => start > order.firstContentfulPaint)
  ).toBe(true);
});
