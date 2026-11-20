import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { calendarButton } from "@/e2e/support/date";
import { waitForStill } from "@/e2e/support/quiet";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The day the spec chooses, named by its month and date whatever the weekday. */
const CHOSEN_DAY = /December 15/u;

/** A phone and a desktop, where the calendar opens in a drawer's or a dialog's picker. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

/** Presses the option of the open select's list, once the list, a sheet on a phone, stands still. */
async function pickOption(page: Page, name: string) {
  const option = page.getByRole("option", { exact: true, name });
  await expect(option).toBeVisible();
  await waitForStill(page.getByRole("listbox"));
  await option.click();
}

/**
 * Chooses a day from the calendar that a date field opens through its month and year selects: December of the year
 * after the one it shows, then the 15th. The field's text then holds the day, in the page's locale.
 */
async function chooseThroughSelects(page: Page, field: Locator) {
  // On a phone the dialog, the calendar and each select's list rise as sheets, so each press waits until its sheet
  // stands still (`chooseDay` says why).
  await waitForStill(field);
  await calendarButton(field).click();
  const calendar = page.locator('[data-slot="date-picker-content"]');
  await expect(calendar).toBeVisible();
  await waitForStill(calendar);
  const year = calendar.getByRole("combobox", { name: "Year" });
  const next = String(Number(await year.innerText()) + 1);
  await calendar.getByRole("combobox", { name: "Month" }).click();
  await pickOption(page, "December");
  await waitForStill(calendar);
  await year.click();
  await pickOption(page, next);
  await expect(calendar.getByRole("combobox", { name: "Month" })).toHaveText(
    "December"
  );
  await expect(year).toHaveText(next);
  await waitForStill(calendar);
  await calendar.getByRole("gridcell", { name: CHOSEN_DAY }).click();
  await expect(calendar).toHaveCount(0);
  await expect(field.locator('[data-slot="date-picker-input"]')).toHaveValue(
    `12/15/${next}`
  );
}

for (const viewport of WIDTHS) {
  test(`the calendar's month and year selects choose a day in every picker at ${viewport.width}px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();

    // An exam's schedule: the day its room opens.
    await page.goto(hostAddress(baseURL, host, "/exams"));
    const create = page.getByRole("button", { name: "Create exam" });
    await waitUntilTakenOver(create);
    await create.click();
    const creating = page.getByRole("dialog");
    await creating.getByRole("textbox", { name: "Exam title" }).fill("Jadwal");
    await creating.getByRole("button", { name: "Create exam" }).click();
    await page.waitForURL(EDITOR_PATH);
    const schedule = page.getByRole("button", { name: "Schedule" });
    await expect(schedule).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await schedule.click();
    await chooseThroughSelects(
      page,
      page.getByRole("dialog").locator('[data-slot="date-picker"]').first()
    );

    // A school period: its first day.
    await page.goto(hostAddress(baseURL, host, "/settings/periods"));
    const add = page.getByRole("button", { name: "Add period" }).first();
    await waitUntilTakenOver(add);
    await add.click();
    await chooseThroughSelects(
      page,
      page.locator('[data-slot="date-picker"]', {
        has: page.getByLabel("First day"),
      })
    );
    await context.close();
  });
}
