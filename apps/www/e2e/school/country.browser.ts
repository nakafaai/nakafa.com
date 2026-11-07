import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * Whether a picker or one of its rows draws a flag that holds a drawing right before its name. Until the
 * flags load, that place holds an empty box of the same size, and the arrow and the tick stand after the name.
 */
const drawsFlag = (row: Locator) =>
  row.evaluate((element) => {
    const flag = element.querySelector(".truncate")?.previousElementSibling;
    return (
      flag instanceof SVGElement &&
      flag.getAttribute("aria-hidden") === "true" &&
      flag.childElementCount > 0 &&
      flag.getBoundingClientRect().width >= 12
    );
  });

for (const viewport of [
  { height: 900, width: 1440 },
  { height: 844, width: 390 },
]) {
  test(`an owner finds a country by name with its flag, the currency follows it with its symbol, a currency is found by name, and both stay after a reload, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInOwner(context, school.slug, address("/")));
    const page = await context.newPage();
    const changes = await Effect.runPromise(trackChanges(page, []));
    await page.goto(address("/settings/profile"));
    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Country and currency" });
    const country = card.getByLabel("Country", { exact: true });
    const currency = card.getByLabel("Currency", { exact: true });
    await waitUntilTakenOver(country);
    await expect(country).toContainText("Indonesia");
    await expect.poll(() => drawsFlag(country)).toBe(true);
    await expect(currency).toContainText("Rp");
    await expect(currency).toContainText("Indonesian Rupiah");

    // Every country of the world is listed: a search by part of its name finds it, flag first.
    await country.click();
    const search = page.getByPlaceholder("Search a country");
    await expect(search).toBeFocused();
    await search.fill("germ");
    const germany = page.getByRole("option", { name: "Germany" });
    await expect(germany).toBeVisible();
    await expect.poll(() => drawsFlag(germany)).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`country-search-${viewport.width}.png`),
    });
    await search.fill("zzzz");
    await expect(page.getByText("Nothing matches.")).toBeVisible();
    await search.fill("Germany");
    await germany.click();
    await expect(search).toBeHidden();
    await expect(country).toContainText("Germany");
    await expect.poll(() => drawsFlag(country)).toBe(true);
    // Germany pays in euros, so its currency follows the country.
    await expect(currency).toContainText("€");
    await expect(currency).toContainText("Euro");

    await currency.click();
    const currencySearch = page.getByPlaceholder("Search a currency");
    await currencySearch.fill("yen");
    const yen = page.getByRole("option", { name: "Japanese Yen" });
    await expect(yen).toContainText("¥");
    await expect(yen).toContainText("JPY");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({
      path: test
        .info()
        .outputPath(`currency-search-dark-${viewport.width}.png`),
    });
    await page.emulateMedia({ colorScheme: "light" });
    await yen.click();
    await expect(currency).toContainText("Japanese Yen");
    await expect(currency).toContainText("¥");

    const before = changes.sent;
    await card.getByRole("button", { name: "Save" }).click();
    // The reload waits for the server, since it would cancel a save still on its way.
    await saved(changes, before);
    await page.reload();
    await expect(country).toContainText("Germany", {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(currency).toContainText("Japanese Yen");
    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`country-saved-${viewport.width}.png`),
    });
    await context.close();
  });
}
