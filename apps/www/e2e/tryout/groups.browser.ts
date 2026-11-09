import { expect, test } from "@playwright/test";
import { groupHref, trackHref } from "@/e2e/support/tryout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** TKA's one grade today, in English: its page holds the subject cards. */
const TKA_GRADE = "/en/try-out/indonesia/tka/senior-high-school";
/** The Aufnahmeprüfung's one Studienkolleg and its one test, in English. */
const DARMSTADT =
  "/en/try-out/germany/aufnahmepruefung/tu-darmstadt-studienkolleg/mathematics";
/** The name of an exam card's link and of a subject card's link. */
const EXAM_CARD = /^View options /u;
const SUBJECT_CARD = /^View sets /u;

/**
 * Every set table is at most two clicks from the hub: picking the exam is the
 * first, and an exam whose group holds several tracks shows their cards, each
 * of which opens a table. A level with one option is never a page.
 */
test("reaches every exam's set table in at most two clicks from the hub", async ({
  page,
}) => {
  await page.goto("/en/try-out");
  const main = page.locator("main");
  const cards = main.getByRole("link", { name: EXAM_CARD });
  const entries = await cards.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? "")
  );
  expect(entries).toEqual([trackHref, TKA_GRADE, DARMSTADT]);

  for (const entry of entries) {
    await page.goto(entry);
    const subjects = main.getByRole("link", { name: SUBJECT_CARD });
    const tables =
      (await subjects.count()) === 0
        ? [entry]
        : await subjects.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href") ?? "")
          );
    for (const table of tables) {
      await page.goto(table);
      await expect(main.getByRole("link", { name: "Set 1" })).toBeVisible();
    }
  }
});

test("draws every exam card of the hub with its artwork, never a gradient", async ({
  page,
}) => {
  await page.goto("/en/try-out");
  const cards = page.locator("main").getByRole("link", { name: EXAM_CARD });

  await expect(cards).toHaveCount(3);
  await expect(page.locator("main img")).toHaveCount(3);
});

/**
 * The header holds one primary control, the learner's own choice: TKA's grade
 * and the Aufnahmeprüfung's Studienkolleg. SNBT's one year is in its name, so
 * its table needs none.
 */
for (const [href, choice, crumb] of [
  [trackHref, undefined, "SNBT 2027"],
  [TKA_GRADE, "Grade", "TKA"],
  [DARMSTADT, "Institution", "Aufnahmeprüfung"],
] as const) {
  test(`${href} keeps one primary control in its header`, async ({ page }) => {
    await page.goto(href);
    const header = page.locator('[data-slot="page-header"]');
    const choices = header.getByRole("combobox");

    await expect(header.getByText(crumb).first()).toBeVisible();
    if (choice === undefined) {
      await expect(choices).toHaveCount(0);
      return;
    }
    await expect(choices).toHaveCount(1);
    await expect(header.getByRole("combobox", { name: choice })).toBeVisible();
  });
}

test("a group's menu lists its exam's groups, each with its icon", async ({
  page,
}) => {
  await page.goto(TKA_GRADE);
  const trigger = page
    .locator('[data-slot="page-header"]')
    .getByRole("combobox", { name: "Grade" });
  await waitUntilTakenOver(trigger);
  await trigger.click();
  const option = page.getByRole("option", { name: "Senior High School" });

  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(option.locator("svg").first()).toBeVisible();
});

/** An exam's official name is never translated, in any locale. */
for (const locale of ["en", "id", "de"] as const) {
  test(`names the Aufnahmeprüfung by its own name in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/try-out`);

    await expect(
      page.locator("main").getByText("Aufnahmeprüfung", { exact: true })
    ).toBeVisible();
  });
}

/**
 * A level with one option answers with its entry for now, and the catalog's
 * retired addresses move to the page they named for good.
 */
for (const [from, to, status] of [
  ["/en/try-out/indonesia/tka", TKA_GRADE, 307],
  ["/en/try-out/indonesia/snbt", trackHref, 307],
  [groupHref, trackHref, 307],
  ["/en/try-out/germany", DARMSTADT, 307],
  [
    "/en/try-out/germany/entrance-examination/tu-darmstadt-studienkolleg/mathematics",
    DARMSTADT,
    308,
  ],
  [
    "/en/try-out/indonesia/tka/compulsory-mathematics",
    `${TKA_GRADE}/compulsory-mathematics`,
    308,
  ],
  ["/en/try-out/indonesia/snbt/2027/set-1", `${trackHref}/set-1`, 308],
] as const) {
  test(`${from} answers ${status} to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });

    expect(response.status()).toBe(status);
    expect(
      new URL(response.headers().location ?? "", "https://x").pathname
    ).toBe(to);
  });
}
