import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { groupHref, trackHref } from "@/e2e/support/tryout";

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
/** The Darmstadt Mathematics test's own design, which its page shares. */
const DARMSTADT_MATHEMATICS =
  /\/open-graph\/tryout\/germany\/entrance-examination\/en-tu-darmstadt-mathematics\.png$/u;
/**
 * The set tables the owner checks: SNBT's one track, whose Indonesian states are
 * the longest, and TKA's compulsory mathematics, where the columns went missing.
 */
const SET_TABLES = [
  trackHref,
  trackHref.replace("/en/", "/id/"),
  `${TKA_GRADE}/compulsory-mathematics`,
  "/id/try-out/indonesia/tka/sma-ma-smk/matematika-wajib",
] as const;
/** The widths at which the set table keeps every column: two phones and a desktop. */
const TABLE_WIDTHS = [320, 390, 1440] as const;

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
 * locale's own country, and a country's page shows its own exams alone, while
 * its crumb opens the other countries.
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

for (const [href, exams, country] of [
  [INDONESIA, [trackHref, TKA_GRADE], "Indonesia"],
  [GERMANY, [DARMSTADT], "Germany"],
] as const) {
  test(`${href} shows its own exams alone, and its crumb opens every country`, async ({
    page,
  }) => {
    await visit(page, href);

    expect(await cardPaths(page, EXAM_CARD)).toEqual(exams);
    await page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: country })
      .click();
    const menu = page.getByRole("group", { name: "Country" });
    await expect(menu.getByRole("menuitemradio")).toHaveText([
      "Indonesia",
      "Germany",
      "Malaysia",
    ]);
    await expect(
      menu.getByRole("menuitemradio", { name: country })
    ).toHaveAttribute("aria-current", "page");
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
 * SNBT and TKA have their own exam artwork. The Aufnahmeprüfung uses a tile
 * until it has its own artwork. Germany and the Darmstadt Mathematics test
 * each keep their own share image.
 */
test("draws each exam card with its own design", async ({ page }) => {
  await visit(page, INDONESIA);
  await expect(page.locator("main img")).toHaveCount(2);
  await expect(page.locator('main [data-slot="tile"]')).toHaveCount(0);

  await visit(page, GERMANY);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator('main [data-slot="tile"]')).toHaveCount(1);
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

test("keeps try-out catalog cards one title line tall on a phone and desktop", async ({
  page,
}) => {
  const name = "Matematika Tingkat Lanjut";
  const grid = page.locator('[data-slot="catalog-grid"]');
  const heading = grid.getByRole("heading", { exact: true, name });
  await visit(page, "/id/try-out/indonesia/tka/sma-ma-smk");
  await expect(heading).toHaveAttribute("title", name);
  await expect(
    grid.getByRole("link", { exact: true, name: `Lihat set ${name}` })
  ).toBeVisible();

  // The served thumbnail can round its height as it scales. The frame keeps
  // the same ratio before that image loads and after it has decoded.
  await grid
    .locator("img")
    .first()
    .evaluate(async (image) => {
      if (image instanceof HTMLImageElement) {
        const thumbnail = document.createElement("canvas");
        thumbnail.width = 768;
        thumbnail.height = 404;
        image.src = thumbnail.toDataURL();
        await image.decode();
      }
    });

  for (const width of [320, 1440]) {
    await page.setViewportSize({ height: 844, width });
    await expect(heading).toHaveCSS("text-overflow", "ellipsis");
    await expect(heading).toHaveCSS("white-space", "nowrap");
    const heights = await grid
      .locator('[data-slot="card"]')
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().height)
      );
    expect(heights.length).toBeGreaterThan(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.1);
    if (width === 1440) {
      expect(
        await heading.evaluate((title) => title.scrollWidth > title.clientWidth)
      ).toBe(true);
    }
  }
});

/**
 * The owner's rule (13 Nov): the breadcrumb is a try-out page's navigation, as
 * Google Drive's path is, so the header holds no control on its right. Each
 * page names its own place last: the grade a learner picks, the Studienkolleg,
 * and the test.
 */
for (const [href, own] of [
  [trackHref, "UTBK"],
  [TKA_GRADE, "Senior High School"],
  [DARMSTADT, "Mathematics"],
] as const) {
  test(`${href} keeps its header to the path`, async ({ page }) => {
    await visit(page, href);
    const header = page.locator('[data-slot="page-header"]');

    await expect(header.getByRole("combobox")).toHaveCount(0);
    await expect(
      header
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { name: own })
    ).toHaveAttribute("aria-current", "page");
  });
}

/**
 * The exam's crumb opens every exam of the country, each with its icon, at
 * every width: in the row on a wide screen, and on a phone, whose row keeps
 * the page's own name, from the path's menu.
 */
for (const width of [390, 1440]) {
  test(`the exam's crumb opens every exam at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width });
    await visit(page, TKA_GRADE);
    const path = page.getByRole("navigation", { name: "breadcrumb" });
    if (width < 640) {
      await path.getByRole("button", { name: "More" }).click();
      await page
        .getByRole("group", { name: "Pages" })
        .getByRole("menuitem", { name: "TKA" })
        .click();
    } else {
      await path.getByRole("button", { name: "TKA" }).click();
    }
    const menu = page.getByRole("group", { name: "Exam" });
    const own = menu.getByRole("menuitemradio", { name: "TKA" });

    await expect(menu.getByRole("menuitemradio")).toHaveCount(2);
    await expect(own).toHaveAttribute("aria-current", "page");
    for (const option of await menu.getByRole("menuitemradio").all()) {
      await expect(option.locator("svg").first()).toBeVisible();
    }
    await menu.getByRole("menuitemradio", { name: "SNBT" }).click();
    await expect(page).toHaveURL(new RegExp(`${trackHref}$`, "u"));
  });
}

test("a short screen scrolls the try-out rows under their sticky header", async ({
  page,
}) => {
  await page.setViewportSize({ height: 170, width: 320 });
  await visit(page, "/id/try-out/indonesia/snbt/2027/utbk");
  const card = page.locator('[data-slot="table-card"]');
  await expect(card.locator("tbody a[href]").first()).toBeAttached();
  const scroll = await card
    .locator('[data-slot="scroll-area-viewport"]')
    .evaluate((viewport) => {
      const head = viewport.querySelector("thead");
      const top = head?.getBoundingClientRect().top ?? 0;
      viewport.scrollTop = viewport.scrollHeight;
      return {
        headShift: (head?.getBoundingClientRect().top ?? 0) - top,
        page: document.documentElement.scrollHeight - window.innerHeight,
        rows: viewport.scrollTop,
      };
    });
  expect(scroll.page).toBeLessThanOrEqual(1);
  expect(scroll.rows).toBeGreaterThan(0);
  expect(Math.abs(scroll.headShift)).toBeLessThanOrEqual(1);
});

/**
 * One table at every width (the owner's rule): every column of a track's sets
 * stands on a phone as on a desktop, Level, Questions, Minutes and Score
 * included, and a card narrower than its columns scrolls them sideways inside
 * itself, under the row's menu, while the page never scrolls sideways. So no head
 * is hidden or zero wide, every row holds a cell under every head, the table's
 * scroll stays inside the card's edges, and once scrolled to its end the last
 * column stands whole beside the menu. Each state badge draws its name whole or
 * cut with an ellipsis inside the badge.
 */
for (const href of SET_TABLES) {
  for (const width of TABLE_WIDTHS) {
    test(`${href} keeps every column of its set table at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 800, width });
      await visit(page, href);
      const card = page.locator('[data-slot="table-card"]');
      await expect(card.locator("tbody tr a[href]").first()).toBeVisible();
      const table = await card.evaluate((element) => {
        const edges = element.getBoundingClientRect();
        const viewport = element.querySelector<HTMLElement>(
          '[data-slot="scroll-area-viewport"]'
        );
        const heads = Array.from(
          element.querySelectorAll<HTMLElement>("thead th")
        );
        const shown = (cell: Element) =>
          getComputedStyle(cell).display !== "none" &&
          cell.getBoundingClientRect().width > 0;
        const hidden = heads
          .filter((head) => !shown(head))
          .map((head, index) => head.textContent?.trim() || `head ${index}`);
        const rows = Array.from(element.querySelectorAll("tbody tr"));
        const short = rows.filter(
          (row) =>
            Array.from(row.querySelectorAll("td")).filter(shown).length !==
            heads.length
        ).length;
        const box = viewport?.getBoundingClientRect();
        const scrolls =
          viewport !== null && viewport.scrollWidth > viewport.clientWidth;
        if (viewport !== null) {
          viewport.scrollLeft = viewport.scrollWidth;
        }
        const last = heads.at(-2)?.getBoundingClientRect();
        const menu = heads.at(-1)?.getBoundingClientRect();
        const badges = Array.from(
          element.querySelectorAll<HTMLElement>(
            "[data-progress] [data-slot=badge]"
          )
        ).filter((badge) => {
          const name = badge.querySelector<HTMLElement>(".truncate");
          return !(
            badge.scrollWidth <= badge.clientWidth &&
            (name === null ||
              name.scrollWidth <= name.clientWidth ||
              getComputedStyle(name).textOverflow === "ellipsis")
          );
        }).length;
        const frame = element.closest('[data-slot="page-list"]');
        const padding =
          frame === null
            ? 0
            : Number.parseFloat(getComputedStyle(frame).paddingBottom);
        return {
          clearance: window.innerHeight - edges.bottom - padding,
          pageScroll:
            document.documentElement.scrollHeight - window.innerHeight,
          cutBadges: badges,
          heads: heads.length,
          hidden,
          inside:
            box !== undefined &&
            box.left >= edges.left - 0.5 &&
            box.right <= edges.right + 0.5,
          lastBesideMenu:
            last !== undefined &&
            menu !== undefined &&
            last.right <= menu.left + 0.5,
          rows: rows.length,
          scrolls,
          short,
        };
      });

      // Six columns of data and the row's menu.
      expect(table.heads).toBe(7);
      expect(table.hidden).toEqual([]);
      expect(table.rows).toBeGreaterThan(0);
      expect(table.short).toBe(0);
      expect(table.inside).toBe(true);
      expect(Math.abs(table.clearance)).toBeLessThanOrEqual(1);
      expect(table.pageScroll).toBeLessThanOrEqual(1);
      expect(table.lastBesideMenu).toBe(true);
      expect(table.cutBadges).toBe(0);
      // On a phone the card must scroll. A desktop may also scroll inside the 3xl column.
      if (width < 768) {
        expect(table.scrolls).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        )
      ).toBeLessThanOrEqual(0);
    });
  }
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
