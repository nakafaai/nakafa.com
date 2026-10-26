import { expect, type Locator, type Page } from "@playwright/test";

/** How many months a test pages through at most before it gives up on a day. */
const MONTH_LIMIT = 36;

/**
 * Chooses one day, written as its day key such as `2027-07-01`, in a design-system date field: it
 * opens the field's calendar, pages forward to the day's month, and presses the day, which closes
 * the calendar.
 */
export async function chooseDay(page: Page, field: Locator, day: string) {
  await field.click();
  const calendar = page.locator('[data-slot="popover-content"]');
  const target = calendar.locator(`button[data-day="${day}"]`).first();
  for (let month = 0; month < MONTH_LIMIT; month += 1) {
    if (await target.isVisible()) {
      break;
    }
    await calendar.getByRole("button", { name: /next/i }).click();
  }
  await target.click();
  await expect(calendar).toHaveCount(0);
}
