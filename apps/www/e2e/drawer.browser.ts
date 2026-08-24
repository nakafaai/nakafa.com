import { expect, type Page, test } from "@playwright/test";

const usageDataName = "Usage data";

test.describe("public Drawer consumers", () => {
  test.describe("compact responsive dialog", () => {
    test.use({ viewport: { height: 844, width: 390 } });

    test("keeps the consent surface as a styled bottom drawer", async ({
      page,
    }) => {
      await page.goto("/en", { waitUntil: "domcontentloaded" });
      const trigger = await prepareConsentPreferences(page);

      await trigger.click();
      const drawer = page.locator('[data-slot="drawer-popup"]');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('[data-slot="drawer-bar"]')).toBeVisible();
      await expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(
        usageDataName
      );
      await expect(
        drawer.locator('[data-slot="drawer-description"]')
      ).toBeVisible();
      await expect(drawer.locator('[data-slot="drawer-panel"]')).toBeVisible();
      await expect(drawer.locator('[data-slot="drawer-footer"]')).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });

  test.describe("desktop responsive dialog", () => {
    test.use({ viewport: { height: 900, width: 1440 } });

    test("keeps the consent surface as a dialog on desktop", async ({
      page,
    }) => {
      await page.goto("/en", { waitUntil: "domcontentloaded" });
      const trigger = await prepareConsentPreferences(page);

      await trigger.click();
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-slot="dialog-title"]')).toHaveText(
        usageDataName
      );
      await expect(page.locator('[data-slot="drawer-popup"]')).toHaveCount(0);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });

  test.describe("Quran interpretation", () => {
    test.use({ viewport: { height: 844, width: 390 } });

    test("keeps the tafsir drawer content and focus behavior", async ({
      page,
    }) => {
      await page.goto("/id/quran/2", { waitUntil: "domcontentloaded" });
      const trigger = page.locator("[data-quran-interpretation-verse]").first();
      await expect(trigger).toBeVisible({ timeout: 15_000 });

      await trigger.click();
      const drawer = page.locator('[data-slot="drawer-popup"]');
      await expect(drawer).toBeVisible({ timeout: 15_000 });
      await expect(drawer.locator('[data-slot="drawer-bar"]')).toBeVisible();
      await expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(
        "Tafsir"
      );
      await expect(
        drawer.locator('[data-slot="drawer-panel"]')
      ).not.toBeEmpty();

      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });
});

async function prepareConsentPreferences(page: Page) {
  const trigger = page.getByRole("button", { name: usageDataName });
  await expect(trigger).toBeVisible();

  const prompt = page.getByRole("region", { name: usageDataName });
  if (await prompt.isVisible()) {
    await prompt.getByRole("button", { name: "Decline" }).click();
    await expect(prompt).toHaveCount(0);
  }

  await trigger.scrollIntoViewIfNeeded();
  return trigger;
}
