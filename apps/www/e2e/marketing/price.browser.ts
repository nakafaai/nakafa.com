import { expect, test } from "@playwright/test";

/** The window list of the CSS properties the page registered. */
const REGISTERED = "nakafaRegisteredProperties";

/** A price's text holds digits. */
const DIGIT = /\d/;

/** The prefix of the CSS properties that an animated number registers. */
const NUMBER_FLOW = "--_number-flow";

/**
 * Each currency's price on the home is its own text that never changes, so
 * the page draws it as text. An animated number registered four CSS
 * properties when its module loaded, which recalculated the style of every
 * element of the page while it hydrated, for a number that never animated.
 */
test("the home draws its prices as text and loads no animated number", async ({
  page,
}) => {
  await page.addInitScript((registered) => {
    const names: string[] = [];
    Reflect.set(window, registered, names);
    const register = CSS.registerProperty.bind(CSS);
    CSS.registerProperty = (definition) => {
      names.push(definition.name);
      register(definition);
    };
  }, REGISTERED);

  await page.goto("/en");
  const pricing = page.locator("#pricing").locator("..");
  await pricing.scrollIntoViewIfNeeded();
  const price = pricing.locator('[data-pricing-price-slot="pro"]');
  // The visitor's currency is the branch that shows.
  await expect(
    price.locator("span:visible").filter({ hasText: DIGIT }).first()
  ).toBeVisible();
  await expect(pricing.locator("number-flow-react")).toHaveCount(0);

  const link = page.locator('header a[href="/en/auth"]').first();
  await expect
    .poll(() =>
      link.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);
  const registered: unknown = await page.evaluate(
    (name) => Reflect.get(window, name),
    REGISTERED
  );
  expect(registered).not.toContainEqual(
    expect.stringMatching(new RegExp(`^${NUMBER_FLOW}`))
  );
});
