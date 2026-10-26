import { expect, type Locator, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { HashSet } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";

/** The drawing of every icon inside `scope`, one string per icon. */
function iconsOf(scope: Locator) {
  return scope
    .locator("svg")
    .evaluateAll((icons) => icons.map((icon) => icon.innerHTML));
}

/**
 * A surface draws each icon once, so an icon says something of its own line.
 * The plans give every feature its own icon, and the two outside links of a
 * content page's sidebar draw only the icon that names them.
 */
test("the plans draw every feature with its own icon", async ({ page }) => {
  await page.goto("/en/pricing");
  const features = page.locator("[data-pricing-plan] ul li");
  await expect(features.first()).toBeVisible();

  const icons = await iconsOf(features);
  expect(icons.length).toBe(await features.count());
  expect(HashSet.size(HashSet.fromIterable(icons))).toBe(icons.length);
});

test("a content page's outside links draw only the icon that names them", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(LESSON_PATH);
  for (const name of [app.Common.report, app.Common["source-code"]]) {
    const link = page.getByRole("link", { exact: true, name });
    await expect(link).toBeVisible();
    expect(await iconsOf(link)).toHaveLength(1);
  }
});
