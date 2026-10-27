import { expect, test } from "@playwright/test";

/** The window list of every change the page made to the theme of its root element. */
const CHANGES = "nakafaThemeChanges";

/**
 * The prepaint script applies the visitor's theme before the first paint, so
 * the page that hydrates finds it there and leaves the root alone. Turning
 * transitions off and on again would change the style of every element of the
 * page twice and recalculate all of them in between, which took over half a
 * second on the home page at a phone's CPU speed.
 */
for (const scheme of ["light", "dark"] as const) {
  test(`a ${scheme} visitor's home hydrates without touching the theme of the page`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript((changes) => {
      const seen: string[] = [];
      Reflect.set(window, changes, seen);
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (
              node instanceof HTMLStyleElement &&
              node.textContent?.includes("transition")
            ) {
              seen.push("transitions off");
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver((records) => {
          for (const record of records) {
            seen.push(`root ${record.attributeName}`);
          }
        }).observe(document.documentElement, {
          attributeFilter: ["class", "style"],
        });
      });
    }, CHANGES);

    await page.goto("/en");
    const signIn = page.locator('header a[href="/en/auth"]').first();
    await expect(signIn).toBeVisible();
    await expect
      .poll(() =>
        signIn.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$"))
        )
      )
      .toBe(true);
    // The store connects in an effect after hydration; two frames see it done.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );

    expect(
      await page.evaluate((changes) => Reflect.get(window, changes), CHANGES)
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.className)).toBe(
      scheme
    );
  });
}
