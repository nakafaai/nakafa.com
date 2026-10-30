import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A phone, where a dialog opens as a drawer from the bottom. */
const PHONE = { height: 844, width: 390 };

/** A wide screen, where the same dialog opens in the middle. */
const DESKTOP = { height: 900, width: 1440 };

/** How far a swipe drags the drawer down before letting go. */
const SWIPE = 400;

/** The scale of the page behind the drawer, as its computed style reads it. */
function stageScale(stage: Locator) {
  return stage.evaluate((element) => getComputedStyle(element).scale);
}

/** Whether the page holds Base UI's scroll lock. */
function scrollLocked(page: Page) {
  return page.evaluate(() =>
    document.documentElement.hasAttribute("data-base-ui-scroll-locked")
  );
}

test("a dialog opens as a drawer on a phone, scales the page back, keeps the focus, and closes on Escape and on a swipe down", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({ viewport: PHONE });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  const stage = page.locator('[data-slot="drawer-stage"]');
  const drawer = page.locator('[data-slot="drawer-popup"]');

  // The dialog opens from the bottom as a drawer, the page behind it scales back, and the page is locked.
  await create.click();
  await expect(drawer).toBeVisible();
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
  await expect.poll(() => scrollLocked(page)).toBe(true);
  await expect.poll(() => stageScale(stage)).toBe("0.94");

  // The focus stays in the drawer however far the writer tabs.
  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press("Tab");
    expect(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement)
      )
    ).toBe(true);
  }

  // Escape closes it, and the page takes its size back and scrolls again.
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect.poll(() => scrollLocked(page)).toBe(false);
  await expect.poll(() => stageScale(stage)).toBe("none");

  // A swipe down on the drawer's bar closes it.
  await create.click();
  await expect(drawer).toBeVisible();
  const bar = await drawer.locator('[data-slot="drawer-bar"]').boundingBox();
  expect(bar).not.toBeNull();
  if (bar !== null) {
    const x = bar.x + bar.width / 2;
    const y = bar.y + bar.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + SWIPE, { steps: 20 });
    await page.mouse.up();
  }
  await expect(drawer).toHaveCount(0);
  await expect.poll(() => stageScale(stage)).toBe("none");

  // On a wide screen the same dialog opens in the middle, and the page keeps its size.
  await page.setViewportSize(DESKTOP);
  await create.click();
  await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible();
  await expect(drawer).toHaveCount(0);
  expect(await stageScale(stage)).toBe("none");
  await context.close();
});
