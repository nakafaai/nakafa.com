import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  LEARNER_TEXT,
  learnerMessage,
  NOTE_NAME,
  note,
  PASTED,
  pictures,
  WORKSHEET_NAME,
  worksheet,
} from "@/e2e/support/prose";
import type { StoredMessage } from "@/e2e/support/query";
import { bubbleOf, drawnRow, openServedChat } from "@/e2e/support/serve";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A message of one word, and a message pasted from a page of exercises. */
const SHORT = learnerMessage({ order: 1, text: LEARNER_TEXT.one });
const LONG = learnerMessage({ order: 2, text: PASTED });

/** Messages with two pictures, with five, and with a document of a long name and one of a short name. */
const TWO = learnerMessage({ files: pictures(2), order: 1, text: "Dua foto" });
const FIVE = learnerMessage({
  files: pictures(5),
  order: 2,
  text: "Lima foto",
});
const WORKSHEET = learnerMessage({
  files: [worksheet],
  order: 3,
  text: WORKSHEET_NAME,
});
const NOTE = learnerMessage({ files: [note], order: 4, text: NOTE_NAME });

/** The height of an element, in pixels. */
const heightOf = (element: Locator) =>
  element.evaluate((node) => node.getBoundingClientRect().height);

/** A pasted message is no taller than the screen, shows twelve lines and opens on request. */
const foldsPastTwelveLines = async (page: Page) => {
  const short = await bubbleOf(page, SHORT);
  const long = await bubbleOf(page, LONG);
  const toggle = long.getByRole("button", { name: "Show more" });
  const screen = page.viewportSize()?.height ?? 0;

  expect.soft(await heightOf(long)).toBeLessThan(screen);
  await expect.soft(short.getByRole("button")).toHaveCount(0);
  await expect.soft(toggle).toHaveAttribute("aria-expanded", "false");

  // The box shows twelve lines and holds the whole text, for find and for copy.
  const folded = await long.evaluate((element) => {
    const box = element.querySelector("[id]");
    if (!(box instanceof HTMLElement)) {
      return null;
    }
    return {
      clipped: box.scrollHeight > box.clientHeight,
      height: box.getBoundingClientRect().height,
      line: Number.parseFloat(getComputedStyle(box).lineHeight),
      text: box.textContent,
    };
  });
  expect.soft(folded?.height).toBeCloseTo((folded?.line ?? 0) * 12, 1);
  expect.soft(folded?.clipped).toBe(true);
  expect.soft(folded?.text).toBe(PASTED);

  await toggle.click({ timeout: readinessTimeoutMilliseconds });
  const open = long.getByRole("button", { name: "Show less" });
  await expect.soft(open).toHaveAttribute("aria-expanded", "true");
  expect.soft(await heightOf(long)).toBeGreaterThan(screen);

  await open.click({ timeout: readinessTimeoutMilliseconds });
  await expect.soft(toggle).toHaveAttribute("aria-expanded", "false");
  expect.soft(await heightOf(long)).toBeLessThan(screen);
};

/**
 * A row of files starts at its first file and scrolls to the last, and a row
 * that fits ends where the message ends. A document of a long name has the
 * widest card there is, 256 pixels (`max-w-64`), which is wider than the
 * column of a phone in CI: at 320 pixels its row scrolled and its card stood 4
 * pixels from the end of the row (run 38424649287). So a short document is
 * held to the end of the row, and the long one to its start and to a name cut
 * inside its card.
 */
const scrollsFilesFromTheFirst = async (page: Page) => {
  const measure = async (message: StoredMessage) =>
    (await drawnRow(page, message)).evaluate((row) => {
      const group = row.querySelector('[data-slot="attachment-group"]');
      const title = row.querySelector('[data-slot="attachment-title"]');
      // A title holds the start of the name, which gives way first, and its end.
      const start = title?.firstElementChild;
      const cards = () =>
        Array.from(row.querySelectorAll('[data-slot="attachment"]'), (card) =>
          card.getBoundingClientRect()
        );
      if (!group) {
        return null;
      }
      const box = group.getBoundingClientRect();
      const before = {
        // How far the last card stands from the end of the row.
        endGap: Math.abs(
          (cards().at(-1)?.right ?? 0) - row.getBoundingClientRect().right
        ),
        firstLeft: (cards().at(0)?.left ?? 0) - box.left,
        scrolls: group.scrollWidth > group.clientWidth,
        // The name of a document is cut at its start, inside its card, never
        // past it.
        titleCut: start ? start.scrollWidth > start.clientWidth : null,
        titlePast: title
          ? title.getBoundingClientRect().right - (cards().at(-1)?.right ?? 0)
          : null,
      };

      group.scrollLeft = group.scrollWidth;
      return {
        ...before,
        lastInside:
          (cards().at(-1)?.right ?? Number.POSITIVE_INFINITY) - box.right,
      };
    });
  const two = await measure(TWO);
  const five = await measure(FIVE);
  const worksheetRow = await measure(WORKSHEET);
  const noteRow = await measure(NOTE);

  expect.soft(two?.lastInside, "two pictures").toBeLessThanOrEqual(0.5);
  expect.soft(five?.lastInside, "five pictures").toBeLessThanOrEqual(0.5);
  expect.soft(noteRow?.lastInside, "a short document").toBeLessThanOrEqual(0.5);
  for (const row of [two, five, worksheetRow, noteRow]) {
    expect.soft(row?.firstLeft).toBeGreaterThanOrEqual(-0.5);
  }
  expect.soft(five?.scrolls).toBe(true);
  expect.soft(worksheetRow?.titleCut).toBe(true);
  expect.soft(worksheetRow?.titlePast).toBeLessThanOrEqual(0.5);
  expect.soft(noteRow?.titleCut).toBe(false);
  expect.soft(noteRow?.scrolls).toBe(false);
  expect.soft(noteRow?.endGap).toBeLessThanOrEqual(1);
};

test.describe("A learner's bubble", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const width of [320, 1440]) {
    test(`at ${width}px folds a pasted message and opens it on request`, async ({
      baseURL,
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, [SHORT, LONG]);
          yield* Effect.promise(() => foldsPastTwelveLines(page));
        })
      );
    });

    test(`at ${width}px carries its files from the first one`, async ({
      baseURL,
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, [TWO, FIVE, WORKSHEET, NOTE]);
          yield* Effect.promise(() => scrollsFilesFromTheFirst(page));
        })
      );
    });
  }

  for (const [locale, more, less] of [
    ["de", "Mehr anzeigen", "Weniger anzeigen"],
    ["id", "Lebih banyak", "Lebih sedikit"],
  ]) {
    test(`at 390px says the fold in ${locale}`, async ({ baseURL, page }) => {
      await page.setViewportSize({ height: 900, width: 390 });
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openServedChat(page, origin, [SHORT, LONG], locale);
          yield* Effect.promise(async () => {
            const bubble = await bubbleOf(page, LONG);

            await bubble
              .getByRole("button", { name: more })
              .click({ timeout: readinessTimeoutMilliseconds });
            await expect(
              bubble.getByRole("button", { name: less })
            ).toBeVisible();
          });
        })
      );
    });
  }
});
