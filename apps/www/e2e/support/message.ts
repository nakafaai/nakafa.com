import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shows a forum message's toolbar as its reader does: a pointer resting on the row, or, on a touch screen, which has
 * no hover, a tap on the row's empty end, which focuses the row and so shows its toolbar. The tap stays clear of the
 * bubble and of the thread's row, which a tap would press.
 */
export async function reachMessage(row: Locator) {
  const touch = await row
    .page()
    .evaluate(() => matchMedia("(hover: none)").matches);
  if (!touch) {
    await row.hover();
    return;
  }
  const box = await row.boundingBox();
  expect(box, "the message row has a box to tap").not.toBeNull();
  if (box === null) {
    return;
  }
  await row.tap({ position: { x: box.width - 4, y: box.height / 2 } });
  await expect(row.getByRole("toolbar")).toHaveCSS("opacity", "1");
}
