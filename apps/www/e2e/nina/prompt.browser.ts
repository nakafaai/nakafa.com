import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  chipsIn,
  composerOf,
  ENGLISH,
  openComposer,
  pickFiles,
  pictureOf,
  runPage,
} from "../support/attachment";
import { seedAnalyticsConsent } from "../support/consent";
import { pinnedRoutes } from "../support/corpus";
import { waitForSlide } from "../support/layout";
import { SHEET_POPUP } from "../support/selector";
import { openSheet } from "../support/sheet";

const PLACEHOLDER = ENGLISH.input;

/** A link the learner pasted: no space to break the line at, as with any long address. */
const LONG_LINK = `https://example.com/${"a".repeat(300)}`;

/** Whether the composer and its two buttons lie inside the page, read in the page. */
const readComposerFit = (form: HTMLElement) => {
  const attach = form.querySelector('button[aria-label="Attach files"]');
  const send = form.querySelector('button[aria-label="Send message"]');
  if (!(attach && send)) {
    return null;
  }
  const inPage = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth;
  };
  return {
    attach: inPage(attach),
    form: inPage(form),
    send: inPage(send),
  };
};

/** A question in Arabic, which the composer reads from the right. */
const ARABIC_QUESTION = "ما معنى الاشتقاق في الرياضيات؟";
/** A question in English, which the composer reads from the left. */
const ENGLISH_QUESTION = "What is a derivative in mathematics?";

test.describe("The composer takes the direction of the text typed in it", () => {
  test("reads Arabic from the right and English from the left", async ({
    page,
  }) => {
    await runPage(
      page,
      Effect.gen(function* () {
        const composer = yield* openComposer(page);
        const input = composerOf(composer);

        yield* Effect.promise(async () => {
          await input.fill(ARABIC_QUESTION);
          await expect(input).toHaveCSS("direction", "rtl");
          await input.fill(ENGLISH_QUESTION);
          await expect(input).toHaveCSS("direction", "ltr");
        });
      })
    );
  });
});

for (const width of [320, 1440]) {
  test.describe(`A long link in the composer at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("keeps the composer and its buttons inside the page", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          const input = composer.getByRole("textbox", { name: PLACEHOLDER });

          yield* Effect.promise(async () => {
            await input.fill(LONG_LINK);
            await expect
              .poll(() => composer.locator("form").evaluate(readComposerFit))
              .toEqual({ attach: true, form: true, send: true });
          });
        })
      );
    });
  });
}

/**
 * Where the send row of the sheet is, and whether a press on it lands, read in
 * the page. A button is in reach when the sheet shows all of it and the
 * element at its middle is the button itself.
 */
const readSendRow = () => {
  const popup = document.querySelector('[data-slot="sheet-popup"][data-open]');
  const form = popup?.querySelector("form");
  const send = form?.querySelector('button[aria-label="Send message"]');
  const attach = form?.querySelector('button[aria-label="Attach files"]');
  const text = form?.querySelector("textarea");
  if (!(popup && form && send && attach && text)) {
    return null;
  }
  const edge = popup.getBoundingClientRect().bottom;
  const inReach = (button: Element) => {
    const box = button.getBoundingClientRect();
    const under = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    return box.bottom <= edge && (under === button || button.contains(under));
  };
  return {
    attachInReach: inReach(attach),
    scrollsInside: text.scrollHeight > text.clientHeight,
    sendInReach: inReach(send),
  };
};

/** The sizes of a phone on its side, and of a 1280 by 800 window at 200 percent zoom. */
const SHORT_SCREENS = [
  { height: 375, name: "a phone on its side", width: 667 },
  { height: 400, name: "a window at 200 percent zoom", width: 640 },
];

for (const screen of SHORT_SCREENS) {
  test.describe(`The sheet on ${screen.name} (${screen.width} by ${screen.height})`, () => {
    test.use({ viewport: { height: screen.height, width: screen.width } });

    test("keeps the send and attach buttons in reach with a photo and a long prompt", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* openSheet(page);
          const sheet = page.locator(SHEET_POPUP);
          yield* waitForSlide(sheet);
          const input = sheet.getByRole("textbox", { name: PLACEHOLDER });
          yield* pickFiles(sheet, [
            yield* pictureOf(page, "nina.png", { height: 90, width: 120 }),
          ]);
          yield* Effect.promise(() => expect(chipsIn(sheet)).toHaveCount(1));

          // Every length the text box can reach: a few lines, past its cap, and far past it.
          for (const lines of [5, 8, 14]) {
            const prompt = Arr.join(
              Arr.makeBy(lines, (index) => `line ${index + 1}`),
              "\n"
            );
            yield* Effect.promise(() => input.fill(prompt));
            const read = yield* Effect.promise(() =>
              expect
                .poll(() => page.evaluate(readSendRow), { timeout: 5000 })
                .toMatchObject({ attachInReach: true, sendInReach: true })
                .then(() => page.evaluate(readSendRow))
            );
            yield* Effect.sync(() => {
              if (lines === 14) {
                expect(read?.scrollsInside).toBe(true);
              }
            });
          }
        })
      );
    });
  });
}

/** The three first prompts the sheet of a German lesson offers. */
const GERMAN_SUGGESTIONS = [
  "Das erklären",
  "Beispielaufgabe zeigen",
  "Kernaussagen zusammenfassen",
];

/**
 * How tall each suggestion is, whether its button is as tall as its label
 * needs, whether the label takes one line, and whether it stays inside its
 * button, read in the page once it has its fonts: a font that swaps in late
 * changes how wide a label is. A button needs the height of its label plus the
 * padding and the border around it, and never less than the least height of a
 * button. A label that is not shown has no box, so it is not read.
 */
const readSuggestions = async (
  popup: HTMLElement,
  labels: readonly string[]
) => {
  await document.fonts.ready;
  return labels.map((text) => {
    const label = Array.from(popup.querySelectorAll("button span")).find(
      (span) => span.textContent === text && span.getClientRects().length > 0
    );
    const button = label?.closest("button");
    if (!(label && button)) {
      return null;
    }
    const box = button.getBoundingClientRect();
    const words = label.getBoundingClientRect();
    const style = getComputedStyle(button);
    const around = [
      style.paddingTop,
      style.paddingBottom,
      style.borderTopWidth,
      style.borderBottomWidth,
    ].reduce((sum, width) => sum + Number.parseFloat(width), 0);
    const needed = Math.max(
      Number.parseFloat(style.minHeight),
      words.height + around
    );
    return {
      height: box.height,
      inside:
        button.scrollWidth <= button.clientWidth &&
        words.right <= box.right &&
        words.top >= box.top &&
        words.bottom <= box.bottom,
      // A second line makes a label twice as tall as the line it is set in.
      oneLine:
        words.height <
        Number.parseFloat(getComputedStyle(label).lineHeight) * 1.5,
      // Not taller than the label needs, which wastes room, and not shorter,
      // which clips the label.
      snug: Math.abs(box.height - needed) < 0.5,
    };
  });
};

/** The text size of the page as a learner sets it in the browser: 100 percent, and a larger one. */
const TEXT_SIZES = [100, 130];

for (const size of TEXT_SIZES) {
  test.describe(`The suggestions of the sheet in German at 320px and ${size} percent text`, () => {
    test.use({ viewport: { height: 640, width: 320 } });

    test("keep their labels inside their buttons", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* Effect.promise(async () => {
            await page.goto(pinnedRoutes.exponent.de);
            await page.addStyleTag({
              content: `html { font-size: ${size}% !important; }`,
            });
            await page
              .getByRole("button", { exact: true, name: "Nina fragen" })
              .click();
          });
          const sheet = page.locator(SHEET_POPUP);
          yield* waitForSlide(sheet);
          // The three first prompts show once the body of the sheet has
          // rendered. A copy of the body that is not shown holds them too.
          yield* Effect.promise(() =>
            expect(
              sheet.getByText(GERMAN_SUGGESTIONS[2]).filter({ visible: true })
            ).toBeVisible()
          );
          const read = yield* Effect.promise(() =>
            sheet.evaluate(readSuggestions, GERMAN_SUGGESTIONS)
          );

          yield* Effect.sync(() => {
            // However many lines a label takes, it stays inside its button,
            // and the button is as tall as its label needs.
            expect(Arr.map(read, (suggestion) => suggestion?.inside)).toEqual([
              true,
              true,
              true,
            ]);
            expect(Arr.map(read, (suggestion) => suggestion?.snug)).toEqual([
              true,
              true,
              true,
            ]);
            // At the ordinary size the two short labels take one line, and
            // their buttons keep the ordinary height, as before. The longest
            // label sits close to the width of its slot, so whether it takes
            // one line or two depends on the width of the letters the browser
            // draws (a CI run drew it on two lines): the button grows with it
            // by design, and it is held to what its label needs above.
            if (size === 100) {
              expect(
                Arr.map(Arr.take(read, 2), (suggestion) => ({
                  height: suggestion?.height,
                  oneLine: suggestion?.oneLine,
                }))
              ).toEqual([
                { height: 36, oneLine: true },
                { height: 36, oneLine: true },
              ]);
            }
          });
        })
      );
    });
  });
}
