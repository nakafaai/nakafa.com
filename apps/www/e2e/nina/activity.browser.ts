import { expect, test } from "@playwright/test";
import { checkFailed, roots } from "@/e2e/support/transcript/math";
import { cutText, startsUnder } from "@/e2e/support/transcript/measure";
import { said } from "@/e2e/support/transcript/message";
import {
  content,
  nakafaSearchFailed,
  quranRefs,
  searchId,
} from "@/e2e/support/transcript/nakafa";
import { onChat } from "@/e2e/support/transcript/open";
import { outcomes } from "@/e2e/support/transcript/outcome";
import { pages, sameHost, webSearchFailed } from "@/e2e/support/transcript/web";

/** Every capability, ended in every way a capability ends short of a plain answer. */
const ROWS = [
  ...outcomes("deepResearch", webSearchFailed),
  ...outcomes("nakafa", nakafaSearchFailed),
  ...outcomes("math", checkFailed),
  said("Nicht alles konnte geprüft werden."),
];

/** The rows of the activity of one reply: the buttons that open a capability. */
const ACTIVITY = 'button[aria-live="polite"]';

/** The label of a row, and the note under it when the capability ended short of a plain answer. */
const LABEL = '[data-slot="activity-label"]';
const NOTE = '[data-slot="activity-note"]';

/** Replies that hold every kind of step: web sources, a read page, Nakafa lessons, a page and a verse, math, and the failures. */
const STEPS = [
  ...sameHost,
  ...pages,
  ...searchId,
  ...content,
  ...quranRefs,
  ...roots,
  ...ROWS,
];

/** One activity of a reply, and the panel that holds its steps. */
const ACTIVITY_ROOT = '[data-slot="message-activity"]';
const PANEL = '[data-slot="collapsible-panel"]';

test.describe("Nina activity rows on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "reads the label and the note of every row in German",
    onChat(ROWS, { locale: "de" }, async (page) => {
      const rows = page.locator(ACTIVITY);

      await expect(rows).toHaveCount(18);
      await expect(
        rows
          .filter({ hasText: "Quellen im Web recherchieren" })
          .filter({ hasText: "Teilweise fertig" })
      ).toHaveCount(1);
      await expect(
        rows.filter({ hasText: "Bitte höchstens 8 Links auf einmal senden" })
      ).toHaveCount(3);
      for (const row of await rows.all()) {
        // The row wraps, so neither its label nor its note is cut.
        expect(await cutText(row)).toEqual([]);
      }
    })
  );

  test(
    "reads the label and the note of every row in Indonesian",
    onChat(ROWS, { locale: "id" }, async (page) => {
      const rows = page.locator(ACTIVITY);

      await expect(rows).toHaveCount(18);
      await expect(
        rows
          .filter({ hasText: "Menelusuri sumber di web" })
          .filter({ hasText: "Sebagian selesai" })
      ).toHaveCount(1);
      for (const row of await rows.all()) {
        expect(await cutText(row)).toEqual([]);
      }
    })
  );

  test(
    "puts the note of a row on a line of its own under the label",
    onChat(ROWS, { locale: "de" }, async (page) => {
      const noted = page.locator(ACTIVITY).filter({ has: page.locator(NOTE) });

      // A partial and an empty result of each of the three capabilities.
      await expect(noted).toHaveCount(6);
      for (const row of await noted.all()) {
        expect(await startsUnder(row.locator(NOTE), row.locator(LABEL))).toBe(
          true
        );
      }
    })
  );
});

test.describe("Nina activity rows at 200 percent zoom", () => {
  // Zoom shrinks the viewport in CSS pixels and keeps its text size: 320 pixels
  // at 200 percent are 160 CSS pixels wide.
  test.use({ viewport: { height: 3200, width: 160 } });

  test(
    "reads the label and the note of every row in German",
    onChat(ROWS, { locale: "de" }, async (page) => {
      const rows = page.locator(ACTIVITY);

      await expect(rows).toHaveCount(18);
      for (const row of await rows.all()) {
        expect(await cutText(row)).toEqual([]);
      }
    })
  );
});

test.describe("Nina evidence hierarchy on a phone", () => {
  test.use({ viewport: { height: 6400, width: 320 } });

  test(
    "draws no text of a step larger than its activity's words and no icon larger than 16 pixels",
    onChat(STEPS, { locale: "id" }, async (page) => {
      const words = page.locator(LABEL).first();

      await expect(words).toBeVisible();
      const limit = await words.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      );
      for (const panel of await page
        .locator(`${ACTIVITY_ROOT} ${PANEL}`)
        .all()) {
        // Math draws its own glyphs, so a formula counts by the size of its
        // root, and the curves inside it are not icons.
        const sizes = await panel.evaluate((root) => {
          const outside = (element: Element) =>
            element.closest(".katex") === null || element.matches(".katex");
          const fonts = [...root.querySelectorAll("*")]
            .filter(outside)
            .filter(
              (element) =>
                element.matches(".katex") ||
                [...element.childNodes].some(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    (node.textContent ?? "").trim() !== ""
                )
            )
            .map((element) =>
              Number.parseFloat(getComputedStyle(element).fontSize)
            );
          const icons = [...root.querySelectorAll("svg, img")]
            .filter((element) => element.closest(".katex") === null)
            .map((element) => {
              const box = element.getBoundingClientRect();
              return Math.max(box.width, box.height);
            });
          return { font: Math.max(0, ...fonts), icon: Math.max(0, ...icons) };
        });
        expect(sizes.font).toBeLessThanOrEqual(limit);
        expect(sizes.icon).toBeLessThanOrEqual(16);
      }
    })
  );

  test(
    "never draws the icon of an activity in one of its steps",
    onChat(STEPS, { locale: "id" }, async (page) => {
      const activities = page.locator(ACTIVITY_ROOT);

      await expect(activities.first()).toBeVisible();
      for (const activity of await activities.all()) {
        const own = await activity
          .locator(`${ACTIVITY} svg`)
          .first()
          .innerHTML();
        const inner = await activity
          .locator(`${PANEL} svg`)
          .evaluateAll((icons) => icons.map((icon) => icon.innerHTML));
        expect(inner).not.toContain(own);
      }
    })
  );

  test(
    "puts each icon in the middle of the first line of its words",
    onChat(STEPS, { locale: "id" }, async (page) => {
      const steps = page.locator('[data-slot="evidence-step"]');
      const sources = page.locator('a[data-slot="hover-card-trigger"]');

      await expect(steps.first()).toBeVisible();
      const off = (icon: string, text: string) =>
        page.evaluate(
          ([iconSelector, textSelector]) =>
            [...document.querySelectorAll(iconSelector)].map((element) => {
              const row = element.parentElement;
              const words = row?.querySelector(textSelector);
              if (!words) {
                return Number.NaN;
              }
              const box = element.getBoundingClientRect();
              const line = words.getBoundingClientRect();
              const height = Number.parseFloat(
                getComputedStyle(words).lineHeight
              );
              return Math.abs(
                box.top + box.height / 2 - (line.top + height / 2)
              );
            }),
          [icon, text] as const
        );
      // A step's icon against its words, and a source's icon against its title.
      for (const gap of await off(
        '[data-slot="evidence-step"] > svg',
        ":scope > span"
      )) {
        expect(gap).toBeLessThanOrEqual(0.5);
      }
      await expect(sources.first()).toBeVisible();
      for (const gap of await off(
        '[data-slot="source-icon"]',
        '[data-slot="source-title"]'
      )) {
        expect(gap).toBeLessThanOrEqual(0.5);
      }
    })
  );
});
