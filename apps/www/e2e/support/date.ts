import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** How many months a test pages through at most before it gives up on a day. */
const MONTH_LIMIT = 36;

/** The calendar's button to the next month, by its accessible name. */
const NEXT_MONTH = /next/iu;

/**
 * Chooses one day, written as its day key such as `2027-07-01`, in a design-system date field: it
 * opens the field's calendar from its button, pages forward to the day's month, and presses the
 * day, which closes the calendar. `field` is the field's text, which its label names.
 */
export async function chooseDay(page: Page, field: Locator, day: string) {
  await page
    .locator('[data-slot="date-picker"]', { has: field })
    .locator('[data-slot="date-picker-trigger"]')
    .click();
  const calendar = page.locator('[data-slot="date-picker-content"]');
  const target = calendar
    .locator(`td[data-value="${day}"]:not([data-outside])`)
    .first();
  for (let month = 0; month < MONTH_LIMIT; month += 1) {
    if (await target.isVisible()) {
      break;
    }
    await calendar.getByRole("button", { name: NEXT_MONTH }).click();
  }
  await target.click();
  await expect(calendar).toHaveCount(0);
}
