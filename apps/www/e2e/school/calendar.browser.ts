import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The day the spec chooses, named by its month and date whatever the weekday. */
const CHOSEN_DAY = /December 15/;

/** A phone and a desktop, where the calendar opens in a drawer's or a dialog's picker. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

/**
 * Chooses a day from the calendar that `picker` opens through its month and year selects: December of the year
 * after the one it shows, then the 15th. The selects lie under the calendar's arrows bar, so a press reaching
 * them proves the bar lets it through. The picker then shows the day.
 */
async function chooseThroughSelects(page: Page, picker: Locator) {
  await picker.click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible();
  const year = calendar.getByRole("combobox", { name: "Year" });
  const next = String(Number(await year.innerText()) + 1);
  await calendar.getByRole("combobox", { name: "Month" }).click();
  await page.getByRole("option", { exact: true, name: "December" }).click();
  await year.click();
  await page.getByRole("option", { exact: true, name: next }).click();
  await expect(calendar.getByRole("combobox", { name: "Month" })).toHaveText(
    "December"
  );
  await expect(year).toHaveText(next);
  await calendar.getByRole("button", { name: CHOSEN_DAY }).click();
  await expect(calendar).toHaveCount(0);
  await expect(picker).toHaveText(`Dec 15, ${next}`);
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
    await chooseThroughSelects(page, page.getByLabel("First day"));
    await context.close();
  });
}
