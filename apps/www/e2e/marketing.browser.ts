import { expect, test } from "@playwright/test";
import { contributors } from "@/lib/data/contributor";

const COMMUNITY_MAX_DESCENDANTS = 400;
const COMMUNITY_MAX_HTML_BYTES = 110_000;
const HOMEPAGE_MAX_DESCENDANTS = 2600;
const TRUST_MAX_DESCENDANTS = 330;

const targetViewports = [
  { desktop: false, height: 800, name: "compact", width: 320 },
  {
    desktop: false,
    hasTouch: true,
    height: 844,
    name: "touch",
    width: 390,
  },
  { desktop: false, height: 1024, name: "tablet-portrait", width: 768 },
  { desktop: true, height: 768, name: "tablet-landscape", width: 1024 },
  { desktop: true, height: 900, name: "desktop", width: 1440 },
] as const;

for (const viewport of targetViewports) {
  test.describe(`marketing surfaces at ${viewport.name}`, () => {
    test.use({
      hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("preserves one responsive content tree and project DOM budgets", async ({
      page,
    }) => {
      await page.goto("/en", { waitUntil: "domcontentloaded" });

      const measurements = await page.evaluate(() => {
        const community = document.querySelector("#community");
        const trust = document.querySelector("#trust");
        const duplicateIds = [...document.querySelectorAll("[id]")]
          .map(({ id }) => id)
          .filter((id, index, ids) => ids.indexOf(id) !== index);

        return {
          communityDescendants: community?.querySelectorAll("*").length ?? -1,
          communityHtmlBytes: new TextEncoder().encode(
            community?.outerHTML ?? ""
          ).byteLength,
          duplicateIds: [...new Set(duplicateIds)],
          homepageDescendants: document.body.querySelectorAll("*").length,
          trustDescendants: trust?.querySelectorAll("*").length ?? -1,
        };
      });

      expect(measurements.duplicateIds).toEqual([]);
      expect(measurements.communityDescendants).toBeLessThanOrEqual(
        COMMUNITY_MAX_DESCENDANTS
      );
      expect(measurements.communityHtmlBytes).toBeLessThanOrEqual(
        COMMUNITY_MAX_HTML_BYTES
      );
      expect(measurements.trustDescendants).toBeLessThanOrEqual(
        TRUST_MAX_DESCENDANTS
      );
      expect(measurements.homepageDescendants).toBeLessThanOrEqual(
        HOMEPAGE_MAX_DESCENDANTS
      );

      const gallery = page.locator("#community [data-contributor-gallery]");
      const triggers = gallery.locator("[data-contributor-username]");
      await expect(gallery).toHaveCount(1);
      await expect(triggers).toHaveCount(contributors.length);
      await expect(page.locator("[data-contributor-drawer]")).toHaveCount(0);

      const trust = page.locator("#trust");
      const primaryPane = trust.locator("[data-trust-primary-pane]");
      const sourcePane = trust.locator("[data-trust-source-pane]");
      const splitter = trust.locator("[data-trust-splitter]");
      await expect(trust.locator("[data-trust-layout]")).toHaveCount(1);
      await expect(primaryPane).toHaveCount(1);
      await expect(sourcePane).toHaveCount(1);
      await expect(primaryPane.locator("article")).toHaveCount(1);
      await expect(sourcePane.locator("aside")).toHaveCount(1);
      await expect(trust.locator('[data-slot="skeleton"]')).toHaveCount(0);

      if (viewport.desktop) {
        await verifyDesktopSplitter(primaryPane, sourcePane, splitter, page);
      } else {
        await expect(splitter).toBeHidden();
        const primaryBox = await primaryPane.boundingBox();
        const sourceBox = await sourcePane.boundingBox();
        expect(primaryBox).not.toBeNull();
        expect(sourceBox).not.toBeNull();
        expect(sourceBox?.y).toBeGreaterThan(primaryBox?.y ?? Number.MAX_VALUE);
      }

      const firstTrigger = triggers.first();
      await firstTrigger.click();
      const drawer = page.locator("[data-contributor-drawer]");
      await expect(drawer).toHaveCount(1);
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveAttribute(
        "data-contributor-username",
        contributors[0]?.username ?? ""
      );

      for (let press = 0; press < 6; press += 1) {
        await page.keyboard.press("Tab");
        expect(
          await drawer.evaluate((element) =>
            element.contains(document.activeElement)
          )
        ).toBe(true);
      }

      if ("hasTouch" in viewport && viewport.hasTouch) {
        await swipeDrawerClosed(drawer, page);
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(drawer).toHaveCount(0);
      await expect(firstTrigger).toBeFocused();

      await firstTrigger.click();
      await page
        .locator('[data-slot="drawer-backdrop"]')
        .click({ position: { x: 2, y: 2 } });
      await expect(drawer).toHaveCount(0);
      await expect(firstTrigger).toBeFocused();
    });
  });
}

test.describe("detached contributor payloads", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("renders every contributor through one drawer root", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const gallery = page.locator("#community [data-contributor-gallery]");
    const drawer = page.locator("[data-contributor-drawer]");

    for (const contributor of contributors) {
      const trigger = gallery.locator(
        `[data-contributor-username="${contributor.username}"]`
      );
      await trigger.click();
      await expect(drawer).toHaveCount(1);
      await expect(drawer).toHaveAttribute(
        "data-contributor-username",
        contributor.username
      );
      await expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(
        contributor.name
      );

      const actualSocialLinks = await drawer
        .locator('a[target="_blank"]')
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? "").sort()
        );
      const expectedSocialLinks = Object.values(contributor.social ?? {})
        .filter((href) => href !== undefined)
        .sort();
      expect(actualSocialLinks).toEqual(expectedSocialLinks);

      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });

  test("uses the same one-root gallery on the contributor page", async ({
    page,
  }) => {
    await page.goto("/en/contributor", { waitUntil: "domcontentloaded" });
    const gallery = page.locator("[data-contributor-gallery]");
    await expect(gallery).toHaveCount(1);
    await expect(gallery.locator("[data-contributor-username]")).toHaveCount(
      contributors.length
    );
    await gallery.locator("[data-contributor-username]").last().click();
    await expect(page.locator("[data-contributor-drawer]")).toHaveCount(1);
  });
});

async function verifyDesktopSplitter(
  primaryPane: import("@playwright/test").Locator,
  sourcePane: import("@playwright/test").Locator,
  splitter: import("@playwright/test").Locator,
  page: import("@playwright/test").Page
) {
  await expect(splitter).toBeVisible();
  await expect(splitter).toHaveAttribute("role", "separator");
  await expect(splitter).toHaveAttribute("aria-controls", "trust-primary-pane");
  await expect(splitter).toHaveAttribute("aria-valuemin", "36");
  await expect(splitter).toHaveAttribute("aria-valuemax", "64");
  await expect(splitter).toHaveAttribute("aria-valuenow", "50");

  const primaryBox = await primaryPane.boundingBox();
  const sourceBox = await sourcePane.boundingBox();
  expect(primaryBox).not.toBeNull();
  expect(sourceBox).not.toBeNull();
  expect(Math.abs((primaryBox?.y ?? 0) - (sourceBox?.y ?? 1))).toBeLessThan(2);
  expect(sourceBox?.x).toBeGreaterThan(primaryBox?.x ?? Number.MAX_VALUE);

  await splitter.focus();
  await page.keyboard.press("ArrowRight");
  await expect(splitter).toHaveAttribute("aria-valuenow", "51");
  await page.keyboard.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", "36");
  await page.keyboard.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", "64");
  await page.keyboard.press("Home");

  const splitterBox = await splitter.boundingBox();
  expect(splitterBox).not.toBeNull();
  if (!splitterBox) {
    return;
  }
  await page.mouse.move(
    splitterBox.x + splitterBox.width / 2,
    splitterBox.y + 8
  );
  await page.mouse.down();
  await page.mouse.move(splitterBox.x + 600, splitterBox.y + 8);
  await page.mouse.up();
  const pointerValue = Number(await splitter.getAttribute("aria-valuenow"));
  expect(pointerValue).toBeGreaterThanOrEqual(36);
  expect(pointerValue).toBeLessThanOrEqual(64);
}

async function swipeDrawerClosed(
  drawer: import("@playwright/test").Locator,
  page: import("@playwright/test").Page
) {
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  if (!drawerBox) {
    return;
  }
  const clientX = drawerBox.x + drawerBox.width / 2;
  const startY = drawerBox.y + 20;
  const endY = Math.min(startY + 320, drawerBox.y + drawerBox.height - 4);
  const body = page.locator("body");

  await drawer.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    clientX,
    clientY: startY,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
  await body.dispatchEvent("pointermove", {
    buttons: 1,
    clientX,
    clientY: endY,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
  await body.dispatchEvent("pointerup", {
    button: 0,
    buttons: 0,
    clientX,
    clientY: endY,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
}
