import { expect, test } from "@playwright/test";
import {
  conditions,
  domain,
  eigen,
  euclid,
  expansion,
  factorial,
  failedCheck,
  loadingCheck,
  roots,
  rref,
} from "@/e2e/support/transcript/math";
import {
  cutText,
  overflow,
  reachable,
  replyOverflow,
  rowOf,
} from "@/e2e/support/transcript/measure";
import { onChat, onSheet } from "@/e2e/support/transcript/open";
import { sameHost } from "@/e2e/support/transcript/web";

/** The label of a step of a derivation, in German. */
const STEP = /^Schritt \d+$/u;

/**
 * The rows of an eigen analysis that crowd a row most: the two whose German
 * labels are the longest, 25 characters each, and the one whose value is the
 * widest, a basis of three vectors.
 */
const LONG_LABELS = [
  "Algebraische Vielfachheit",
  "Geometrische Vielfachheit",
  "Basis des Eigenraums",
];

test.describe("Nina math on a phone", () => {
  test.use({ viewport: { height: 3600, width: 320 } });

  test(
    "keeps the value of a row with a long German label on the row",
    onChat(eigen, { locale: "de" }, async (page) => {
      for (const text of LONG_LABELS) {
        const label = page.getByText(text);

        await expect(label).toBeVisible();
        expect(await cutText(label)).toEqual([]);
        // The value is beside its label, or under it, and never pushed off the row.
        expect(await reachable(rowOf(label))).toBe(true);
      }
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "scrolls a number of 65 digits inside the scroll area, with its fade",
    onChat(factorial, { locale: "de" }, async (page) => {
      const row = rowOf(page.getByText("Ergebnis"));
      const viewport = row
        .locator('[data-slot="scroll-area-viewport"]')
        .first();

      await expect(viewport).toBeVisible();
      const facts = await viewport.evaluate((element) => ({
        fade: getComputedStyle(element).maskImage !== "none",
        scrolls: element.scrollWidth > element.clientWidth,
      }));
      expect(facts).toEqual({ fade: true, scrolls: true });
      // Nothing else on the page scrolls sideways.
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "scrolls an expansion of 21 terms and a polynomial of 474 characters",
    onChat([...expansion, ...roots], { locale: "de" }, async (page) => {
      const expanded = rowOf(page.getByText("Schritt 1"));
      const given = rowOf(page.getByText("Gegeben"));

      expect(await reachable(expanded)).toBe(true);
      expect(await reachable(given)).toBe(true);
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "wraps the label of an operation in the header",
    onChat(rref, { locale: "de" }, async (page) => {
      const header = page.getByRole("button", {
        name: "Matrix in reduzierte Zeilenstufenform bringen",
      });

      await expect(header).toBeVisible();
      expect(await cutText(header)).toEqual([]);
    })
  );

  test(
    "names the operation of a check that failed under the activity that names the failure",
    onChat(failedCheck, { locale: "de" }, async (page) => {
      const activity = page.getByRole("button", {
        name: "Mathematische Prüfung fehlgeschlagen",
      });
      const check = page.getByRole("button", { name: "Vereinfachen" });

      // Only the activity says that the check failed; the check says which one.
      await expect(activity).toHaveCount(1);
      await expect(check).toHaveCount(1);
      for (const header of [activity, check]) {
        expect(await cutText(header)).toEqual([]);
      }
    })
  );

  test(
    "shows a check that is still working, and a domain with its condition",
    onChat(
      [...loadingCheck, ...domain],
      { locale: "de", running: true },
      async (page) => {
        await expect(page.getByText("Berechnung läuft...")).toBeVisible();
        const condition = rowOf(page.getByText("Bedingung"));

        expect(await reachable(condition)).toBe(true);
      }
    )
  );

  test(
    "shows five steps first and the other 35 behind one button",
    onChat(euclid, { locale: "de" }, async (page) => {
      const steps = page.getByText(STEP);

      await expect(steps).toHaveCount(5);
      await page.getByRole("button", { name: "Mehr anzeigen" }).click();
      await expect(steps).toHaveCount(40);
      await page.getByRole("button", { name: "Weniger anzeigen" }).click();
      await expect(steps).toHaveCount(5);
    })
  );

  test(
    "shows five items first and the rest behind one button",
    onChat(roots, { locale: "de" }, async (page) => {
      const items = page.getByText("Nullstelle", { exact: true });

      await expect(items).toHaveCount(5);
      await page.getByRole("button", { name: "Mehr anzeigen" }).click();
      await expect(items).toHaveCount(20);
    })
  );

  test(
    "shows five conditions first and the other three behind one button",
    onChat(conditions, { locale: "de" }, async (page) => {
      const row = rowOf(page.getByText("Bedingung"));
      const shown = row.locator(".katex");

      await expect(shown).toHaveCount(5);
      expect(await reachable(row)).toBe(true);
      await page.getByRole("button", { name: "Mehr anzeigen" }).click();
      await expect(shown).toHaveCount(8);
      expect(await reachable(row)).toBe(true);
      await page.getByRole("button", { name: "Weniger anzeigen" }).click();
      await expect(shown).toHaveCount(5);
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "starts each level where the words of the level above start, with one rail",
    onChat(sameHost, { locale: "id" }, async (page) => {
      const activity = page.locator('[data-slot="message-activity"]').first();
      const words = activity.locator('[data-slot="activity-label"]');
      const step = activity.locator('[data-slot="evidence-step"]').first();
      const query = page.getByText('"turunan fungsi"');
      const source = activity.locator('a[data-slot="hover-card-trigger"]');
      const panel = page.locator('[data-slot="collapsible-panel"]').first();
      const left = async (locator: typeof query) =>
        (await locator.boundingBox())?.x ?? Number.NaN;

      await expect(query).toBeVisible();
      // The activity's rail runs under its icon, and its steps start where its
      // words start: an indent of 8, a rail of 1 and a gap of 15. A step's
      // details start where the step's words start, and so does the icon of
      // each source under it. A level that starts 1 pixel off reads crooked.
      expect(await left(step.locator("svg"))).toBeCloseTo(await left(words), 0);
      const stepWords = await left(step.locator("span").last());
      expect(await left(query)).toBeCloseTo(stepWords, 0);
      for (const row of await source.all()) {
        expect(
          await left(row.locator('[data-slot="source-icon"]'))
        ).toBeCloseTo(stepWords, 0);
      }
      // The query ends where the column of the activity ends.
      const column = await activity.boundingBox();
      const box = await query.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeCloseTo(
        (column?.x ?? 0) + (column?.width ?? 0),
        0
      );
      const rails = await panel.evaluate(
        (element) =>
          [element, ...element.querySelectorAll("*")].filter(
            (child) => getComputedStyle(child).borderInlineStartWidth === "1px"
          ).length
      );
      expect(rails).toBe(1);
    })
  );
});

test.describe("Nina math at 200 percent zoom", () => {
  // Zoom shrinks the viewport in CSS pixels and keeps its text size: 320 pixels
  // at 200 percent are 160 CSS pixels wide.
  test.use({ viewport: { height: 3600, width: 160 } });

  test(
    "keeps every value of a row reachable and the replies within the page",
    onChat(eigen, { locale: "de" }, async (page) => {
      for (const text of LONG_LABELS) {
        const label = page.getByText(text);

        await expect(label).toBeVisible();
        expect(await cutText(label)).toEqual([]);
        expect(await reachable(rowOf(label))).toBe(true);
      }
      // The header of the site is wider than 160 pixels, so the page itself
      // scrolls sideways here. What the replies hold does not reach past it.
      expect(await replyOverflow(page)).toBe(0);
    })
  );
});

test.describe("Nina math in the sheet", () => {
  test.use({ viewport: { height: 3600, width: 1024 } });

  test(
    "keeps the value of a row with a long German label on the row in the compact sheet",
    onSheet(eigen, { locale: "de" }, async (page) => {
      for (const text of LONG_LABELS) {
        const label = page.getByText(text);

        await expect(label).toBeVisible();
        expect(await reachable(rowOf(label))).toBe(true);
      }
    })
  );
});
