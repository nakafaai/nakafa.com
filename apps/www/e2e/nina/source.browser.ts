import { expect, test } from "@playwright/test";
import {
  clamped,
  clippedInk,
  cutText,
  lines,
  overflow,
} from "@/e2e/support/transcript/measure";
import { onChat, onSheet } from "@/e2e/support/transcript/open";
import {
  EXERCISE_TITLE,
  failedWebSearch,
  LESSON_TITLE,
  LONG_ADDRESS,
  LONG_HOST,
  legacy,
  loading,
  manyResults,
  noResults,
  oneResult,
  pages,
  queries,
  sameHost,
} from "@/e2e/support/transcript/web";

/** Every row of a source on the page: the link that a source is. */
const SOURCE = 'a[data-slot="hover-card-trigger"]';

/** The title of a row, and the host under it. */
const TITLE = '[data-slot="source-title"]';
const HOST = '[data-slot="source-host"]';

/** The ends of the title of 200 characters and of the file name, which a clamp at two lines cuts. */
const TITLE_END = /Portal Belajar Matematika Daring\./u;
const FILE_END = /Versi_2026\.pdf/u;

/** The mark of a Thai title's tall vowels and the stacked marks of a Vietnamese one. */
const TALL_TITLES = ["Đặng Thị Ngọc Hân", "แคลคูลัสเบื้องต้น"];

test.describe("Nina web sources on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "reads two results on one host apart, without a pointer",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const lesson = page.getByRole("link", { name: LESSON_TITLE });
      const exercises = page.getByRole("link", { name: EXERCISE_TITLE });

      // A tap never opens the card of a pointer, so each title is on its row.
      await expect(lesson).toBeVisible();
      await expect(exercises).toBeVisible();
      await expect(lesson).toContainText(LONG_HOST);
      await expect(exercises).toContainText(LONG_HOST);
      expect(await cutText(lesson)).toEqual([]);
      expect(await cutText(exercises)).toEqual([]);
      // Only the last word tells the two titles apart, so it must show: each
      // title takes two lines and none of it is cut. A title cut to one line, or
      // cut after the second, fails here.
      for (const row of [lesson, exercises]) {
        expect(await lines(row.locator(TITLE))).toBe(2);
        expect(await clamped(row.locator(TITLE))).toBe(false);
      }
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "opens the description of a result in a card on a pointer",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const description = page.getByText(
        "Penjelasan turunan fungsi aljabar dengan rumus dasar dan contoh soal."
      );

      await expect(description).toHaveCount(0);
      // The card opens when the pointer enters the row, so it comes from outside.
      await page.mouse.move(2, 2);
      await page.getByRole("link", { name: LESSON_TITLE }).hover();
      await expect(description).toBeVisible();
      expect(await cutText(description)).toEqual([]);
    })
  );

  test(
    "wraps a description that is one unbroken address inside the card",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const description = page.getByText(LONG_ADDRESS, { exact: true });

      await expect(description).toHaveCount(0);
      await page.mouse.move(2, 2);
      await page
        .getByRole("link", { name: "Modul Integral Tak Tentu Kelas XII" })
        .hover();
      await expect(description).toBeVisible();
      // The address breaks where the card ends, and the card shows two lines of it.
      expect(await cutText(description)).toEqual([]);
      expect(await lines(description)).toBe(2);
    })
  );

  test(
    "wraps a long host, a long title and a file name instead of cutting them sideways",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const rows = page.locator(SOURCE);

      await expect(rows.filter({ hasText: "Modul_Matematika" })).toBeVisible();
      // Nothing in any row is cut: not the file name, not the host of 33 characters.
      for (const row of await rows.all()) {
        expect(await cutText(row)).toEqual([]);
      }
    })
  );

  test(
    "cuts a title that runs past two lines, and keeps all of it in the name of the link",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const rows = page.locator(SOURCE);
      // A title of 200 characters, and a file name of 63 that has no place to
      // break: the end of each is what the cut takes, the extension of the file.
      const cut = [
        {
          end: TITLE_END,
          host: "belajar.example.test",
          row: rows.filter({ hasText: "Portal Belajar Matematika" }),
        },
        {
          end: FILE_END,
          host: LONG_HOST,
          row: rows.filter({ hasText: "Modul_Matematika" }),
        },
      ];

      for (const { end, host, row } of cut) {
        await expect(row).toBeVisible();
        // A title shows two lines at most, by decision: the rest of it is cut.
        // A reader who does not see the end still has it in the name of the
        // link, and the row is still the link.
        expect(await lines(row.locator(TITLE))).toBe(2);
        expect(await clamped(row.locator(TITLE))).toBe(true);
        await expect(row).toHaveAccessibleName(end);
        expect(await row.getAttribute("href")).toContain(host);
      }
    })
  );

  test(
    "keeps the rows aligned when an icon does not load",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const titles = page.locator(TITLE);
      const broken = page
        .locator(SOURCE)
        .filter({ hasText: "broken-icon.example.test" });

      await expect(broken).toBeVisible();
      await expect(titles.first()).toBeVisible();
      const chip = broken.locator('[data-slot="source-icon"]');
      // The chip holds a globe, never a broken image.
      await expect(chip.locator("svg")).toBeVisible();
      await expect(chip.locator("img")).toHaveCount(0);
      const left = async (title: typeof titles) =>
        (await title.boundingBox())?.x;
      expect(await left(broken.locator(TITLE))).toBe(
        await left(titles.first())
      );
    })
  );

  test(
    "keeps a black icon on a transparent ground visible in the dark theme",
    onChat(sameHost, { dark: true, locale: "id" }, async (page) => {
      const icon = page
        .getByRole("link", { name: "monochrome.example.test" })
        .locator("img");

      await expect(icon).toBeVisible();
      // The ground of the icon is the first box behind it that has a colour.
      const contrast = await icon.evaluate((image) => {
        let ground = image.parentElement;
        while (
          ground &&
          getComputedStyle(ground).backgroundColor === "rgba(0, 0, 0, 0)"
        ) {
          ground = ground.parentElement;
        }
        const canvas = document.createElement("canvas").getContext("2d");
        if (!(ground && canvas)) {
          return 0;
        }
        canvas.fillStyle = getComputedStyle(ground).backgroundColor;
        canvas.fillRect(0, 0, 1, 1);
        const [red = 0, green = 0, blue = 0] = canvas.getImageData(
          0,
          0,
          1,
          1
        ).data;
        const light = (channel: number) => {
          const value = channel / 255;
          return value <= 0.039_28
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        };
        const luminance =
          0.2126 * light(red) + 0.7152 * light(green) + 0.0722 * light(blue);
        // The contrast of the ground with a black mark.
        return (luminance + 0.05) / 0.05;
      });
      expect(contrast).toBeGreaterThanOrEqual(7);
    })
  );

  test(
    "lists the most results one card holds, ten rows, and cuts none",
    onChat(manyResults, { locale: "id" }, async (page) => {
      const rows = page.locator(SOURCE);

      await expect(rows).toHaveCount(10);
      for (const row of await rows.all()) {
        expect(await cutText(row)).toEqual([]);
      }
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "says it when a search found nothing or failed, and shows a single result as one row",
    onChat(
      [...noResults, ...failedWebSearch, ...oneResult],
      { locale: "id" },
      async (page) => {
        await expect(
          page.getByText("Tidak ada sumber yang didapatkan.")
        ).toBeVisible();
        await expect(page.getByText("Pencarian belum berhasil.")).toBeVisible();
        // One result of the second search and the one result of the third.
        await expect(page.locator(SOURCE)).toHaveCount(2);
        await expect(
          page.getByRole("link", { name: "Teorema Pythagoras" })
        ).toBeVisible();
      }
    )
  );
});

test.describe("Nina scraped pages on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "gives the page of a running read its own line, and shows its host in full",
    onChat(loading, { locale: "de", running: true }, async (page) => {
      const row = page.locator(SOURCE).filter({ hasText: "ppid" });
      const status = page.getByText("Quelle wird gelesen...");

      await expect(row).toBeVisible();
      await expect(status).toBeVisible();
      expect(await cutText(row)).toEqual([]);
      // The status is a line above the row, so neither takes the other's width.
      const above = await status.boundingBox();
      const below = await row.boundingBox();
      expect((above?.y ?? 0) + (above?.height ?? 0)).toBeLessThanOrEqual(
        below?.y ?? 0
      );
    })
  );

  test(
    "shows a page without a title under its host",
    onChat(pages, { locale: "de" }, async (page) => {
      const row = page.locator(SOURCE).filter({ hasText: "example.org" });

      await expect(row.locator(TITLE)).toHaveText("example.org");
      await expect(row.locator(HOST)).toHaveCount(0);
    })
  );
});

test.describe("Nina sources of older answers on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "shows a source with its title and its host, and a source without a title under its host",
    onChat(legacy, { locale: "id" }, async (page) => {
      const wikipedia = page.getByRole("link", { name: "Turunan - Wikipedia" });
      const untitled = page.locator(SOURCE).filter({ hasText: "example.org" });

      await expect(wikipedia).toBeVisible();
      await expect(wikipedia).toContainText("id.wikipedia.org");
      expect(await cutText(wikipedia)).toEqual([]);
      await expect(untitled.locator(TITLE)).toHaveText("example.org");
    })
  );

  test(
    "does not clip the marks of tall scripts",
    onChat(legacy, { locale: "id" }, async (page) => {
      for (const title of TALL_TITLES) {
        const text = page.getByRole("link", { name: title }).locator(TITLE);

        await expect(text).toBeVisible();
        expect(await clippedInk(text)).toEqual({ above: 0, below: 0 });
      }
    })
  );

  test(
    "gives the text of a source the direction of its own script",
    onChat(legacy, { locale: "id" }, async (page) => {
      const arabic = page
        .getByRole("link", { name: "نور الهدى عبد الرحمن" })
        .locator(TITLE);
      const latin = page
        .getByRole("link", { name: "Turunan - Wikipedia" })
        .locator(TITLE);

      await expect(arabic).toHaveCSS("direction", "rtl");
      await expect(latin).toHaveCSS("direction", "ltr");
    })
  );

  test(
    "reads a long query and an Arabic one in full, each in its own direction",
    onChat(queries, { locale: "id" }, async (page) => {
      const address = page.getByText(LONG_ADDRESS.slice(0, 40));
      const arabic = page.getByText('"نور الهدى عبد الرحمن"', { exact: true });

      await expect(address).toBeVisible();
      expect(await cutText(address)).toEqual([]);
      await expect(arabic).toHaveCSS("direction", "rtl");
      await expect(address).toHaveCSS("direction", "ltr");
    })
  );
});

test.describe("Nina web sources in the sheet", () => {
  test.use({ viewport: { height: 2400, width: 1024 } });

  test(
    "reads two results on one host apart in the compact sheet",
    onSheet(sameHost, { locale: "id" }, async (page) => {
      const lesson = page.getByRole("link", { name: LESSON_TITLE });
      const exercises = page.getByRole("link", { name: EXERCISE_TITLE });

      await expect(lesson).toBeVisible();
      await expect(exercises).toBeVisible();
      expect(await cutText(lesson)).toEqual([]);
      expect(await cutText(exercises)).toEqual([]);
      for (const row of [lesson, exercises]) {
        expect(await clamped(row.locator(TITLE))).toBe(false);
      }
    })
  );
});
