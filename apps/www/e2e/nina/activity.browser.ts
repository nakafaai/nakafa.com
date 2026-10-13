import { expect, test } from "@playwright/test";
import { checkFailed } from "@/e2e/support/transcript/math";
import { cutText, startsUnder } from "@/e2e/support/transcript/measure";
import { said } from "@/e2e/support/transcript/message";
import { nakafaSearchFailed } from "@/e2e/support/transcript/nakafa";
import { onChat } from "@/e2e/support/transcript/open";
import { outcomes } from "@/e2e/support/transcript/outcome";
import { webSearchFailed } from "@/e2e/support/transcript/web";

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
