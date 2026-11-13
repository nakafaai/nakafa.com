import { expect, type Page, test } from "@playwright/test";
import { groupHref, trackHref } from "@/e2e/support/tryout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** Indonesia's page, which holds SNBT and TKA. */
const INDONESIA = "/en/try-out/indonesia";
/** Germany's page, which holds the Aufnahmeprüfung. */
const GERMANY = "/en/try-out/germany";
/** TKA's one grade today, in English: its page holds the subject cards. */
const TKA_GRADE = "/en/try-out/indonesia/tka/senior-high-school";
/** The Aufnahmeprüfung's one Studienkolleg and its one test, in English. */
const DARMSTADT =
  "/en/try-out/germany/aufnahmepruefung/tu-darmstadt-studienkolleg/mathematics";
/** The name of an exam card's link and of a subject card's link. */
const EXAM_CARD = /^View options /u;
const SUBJECT_CARD = /^View sets /u;
/** The country's design, which only its own page's metadata names. */
const GERMANY_DESIGN = /\/open-graph\/tryout\/germany\/en-index\.png$/u;
/** TU Darmstadt's Studienkolleg's mark, the Aufnahmeprüfung card's image, as a card draws it. */
const DARMSTADT_MARK =
  "/open-graph/tryout/germany/en-entrance-examination.webp";
/** The Darmstadt Mathematics test's own design, which its page shares. */
const DARMSTADT_MATHEMATICS =
  /\/open-graph\/tryout\/germany\/entrance-examination\/en-tu-darmstadt-mathematics\.png$/u;
/** A size an image declares, in whole pixels. */
const PIXELS = /^\d+$/u;
/** The class of a filled control, which no header control wears. */
const FILLED = /bg-primary/u;
/** The phone widths at which a set's name, status and menu read whole. */
const PHONE_WIDTHS = [320, 360, 390, 430] as const;

/**
 * Opens a page and lets it finish loading before a test leaves it. In Firefox
 * and WebKit a page left while it was still loading navigated to its own
 * address and interrupted the next one, so a walk across pages waits.
 */
async function visit(page: Page, href: string) {
  await page.goto(href);
  await page.waitForLoadState("networkidle");
}

/** The paths a page's card links of one kind open, in order. */
function cardPaths(page: Page, name: RegExp) {
  return page
    .locator("main")
    .getByRole("link", { name })
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? "")
    );
}

/**
 * Every page belongs to one country: the address of Try out opens the
 * locale's own country, and a country's page shows its own exams alone, with
 * the country selector in its header.
 */
for (const [locale, country] of [
  ["en", INDONESIA],
  ["id", "/id/try-out/indonesia"],
  ["de", "/de/try-out/deutschland"],
] as const) {
  test(`the address of Try out opens one country in ${locale}`, async ({
    request,
  }) => {
    const response = await request.get(`/${locale}/try-out`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(
      new URL(response.headers().location ?? "", "https://x").pathname
    ).toBe(country);
  });
}

for (const [href, exams] of [
  [INDONESIA, [trackHref, TKA_GRADE]],
  [GERMANY, [DARMSTADT]],
] as const) {
  test(`${href} shows its own exams alone, beside its country selector`, async ({
    page,
  }) => {
    await visit(page, href);

    expect(await cardPaths(page, EXAM_CARD)).toEqual(exams);
    await expect(
      page
        .locator('[data-slot="page-header"]')
        .getByRole("combobox", { name: "Country" })
    ).toBeVisible();
  });
}

/**
 * Every set table is at most two clicks from its country's page: picking the
 * exam is the first, and an exam whose group holds several tracks shows their
 * cards, each of which opens a table.
 */
test("reaches every exam's set table in at most two clicks from its country", async ({
  page,
}) => {
  const main = page.locator("main");
  for (const country of [INDONESIA, GERMANY]) {
    await visit(page, country);
    for (const entry of await cardPaths(page, EXAM_CARD)) {
      await visit(page, entry);
      const subjects = await cardPaths(page, SUBJECT_CARD);
      for (const table of subjects.length === 0 ? [entry] : subjects) {
        await visit(page, table);
        await expect(main.getByRole("link", { name: "Set 1" })).toBeVisible();
      }
    }
  }
});

/**
 * A card wears only its own entity's design: SNBT and TKA their exam art, and
 * the Aufnahmeprüfung TU Darmstadt's Studienkolleg's mark, each a self-hosted
 * image with its size set and no text over it. A country's design stands in its
 * page's metadata alone, and the Darmstadt Mathematics test shares its own.
 */
test("draws each exam card with its own design", async ({ page }) => {
  await visit(page, INDONESIA);
  await expect(page.locator("main img")).toHaveCount(2);
  await expect(page.locator('main [data-slot="tile"]')).toHaveCount(0);

  await visit(page, GERMANY);
  const mark = page.locator("main img");
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute("src", DARMSTADT_MARK);
  await expect(mark).toHaveAttribute("width", PIXELS);
  await expect(mark).toHaveAttribute("height", PIXELS);
  await expect(page.locator('main [data-slot="tile"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    GERMANY_DESIGN
  );

  await visit(page, DARMSTADT);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    DARMSTADT_MATHEMATICS
  );
});

/**
 * The header's controls are outline buttons, never a filled one: the exam and,
 * where the learner picks it, their grade or Studienkolleg.
 */
for (const [href, names] of [
  [trackHref, ["Exam"]],
  [TKA_GRADE, ["Exam", "Grade"]],
  [DARMSTADT, ["Exam", "Institution"]],
] as const) {
  test(`${href} keeps outline controls in its header`, async ({ page }) => {
    await visit(page, href);
    const header = page.locator('[data-slot="page-header"]');

    await expect(header.getByRole("combobox")).toHaveCount(names.length);
    for (const name of names) {
      const control = header.getByRole("combobox", { name });
      await expect(control).toBeVisible();
      await expect(control).not.toHaveClass(FILLED);
    }
  });
}

test("a group's menu lists its exam's groups, each with its icon", async ({
  page,
}) => {
  await visit(page, TKA_GRADE);
  const trigger = page
    .locator('[data-slot="page-header"]')
    .getByRole("combobox", { name: "Grade" });
  await waitUntilTakenOver(trigger);
  await trigger.click();
  const option = page.getByRole("option", { name: "Senior High School" });

  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(option.locator("svg").first()).toBeVisible();
});

/**
 * On a phone a set's name, its status and its menu read whole, without
 * scrolling sideways: the card does not scroll, and every box drawn inside it
 * stays within its edges. The boxes are measured, not each element's scroll
 * size, because a visually hidden label is 1 px wide and reports its whole text
 * as overflow in every engine.
 */
for (const width of PHONE_WIDTHS) {
  test(`the set table fits a ${width} px phone`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    await visit(page, trackHref);
    const card = page.locator('[data-slot="table-card"]');
    const row = card.getByRole("row").filter({ hasText: "Set 1" });

    await expect(row.getByRole("link", { name: "Set 1" })).toBeVisible();
    await expect(
      row.getByRole("button", { name: "More actions" })
    ).toBeInViewport();
    const fit = await card.evaluate((element) => {
      const edges = element.getBoundingClientRect();
      const spills = Array.from(
        element.querySelectorAll<HTMLElement>("*"),
        (child) => {
          const box = child.getBoundingClientRect();
          return box.width === 0
            ? 0
            : Math.max(box.right - edges.right, edges.left - box.left);
        }
      );
      return {
        scroll: element.scrollWidth - element.clientWidth,
        spill: Math.max(0, ...spills),
      };
    });
    expect(fit.scroll).toBeLessThanOrEqual(0);
    // Half a pixel of a rounded edge is no spill.
    expect(fit.spill).toBeLessThanOrEqual(0.5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
    ).toBeLessThanOrEqual(0);
  });
}

/** An exam's official name is never translated, in any locale. */
for (const country of [
  GERMANY,
  "/id/try-out/jerman",
  "/de/try-out/deutschland",
]) {
  test(`names the Aufnahmeprüfung by its own name on ${country}`, async ({
    page,
  }) => {
    await visit(page, country);

    await expect(
      page.locator("main").getByRole("heading", { name: "Aufnahmeprüfung" })
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
