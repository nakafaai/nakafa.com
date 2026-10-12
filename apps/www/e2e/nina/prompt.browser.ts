import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import {
  chipsIn,
  ENGLISH,
  openComposer,
  pickFiles,
  pictureOf,
  runPage,
} from "@/e2e/support/attachment";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForSlide } from "@/e2e/support/layout";
import { SHEET_POPUP } from "@/e2e/support/selector";

const LESSON =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
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
] as const;

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
          yield* Effect.promise(async () => {
            await page.goto(LESSON);
            await page
              .getByRole("button", { exact: true, name: "Ask Nina" })
              .click();
          });
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

/** A lesson of the German site, and the three first prompts its sheet offers. */
const GERMAN_LESSON =
  "/de/faecher/mathematik/potenzen-und-logarithmen/grundlagen";
const GERMAN_SUGGESTIONS = [
  "Das erklären",
  "Beispielaufgabe zeigen",
  "Kernaussagen zusammenfassen",
] as const;

/**
 * How tall each suggestion is, and whether its label stays inside its button,
 * read in the page. A label that is not shown has no box, so it is not read.
 */
const readSuggestions = (popup: HTMLElement, labels: readonly string[]) =>
  labels.map((text) => {
    const label = Array.from(popup.querySelectorAll("button span")).find(
      (span) => span.textContent === text && span.getClientRects().length > 0
    );
    const button = label?.closest("button");
    if (!(label && button)) {
      return null;
    }
    const box = button.getBoundingClientRect();
    return {
      height: box.height,
      inside:
        button.scrollWidth <= button.clientWidth &&
        label.getBoundingClientRect().right <= box.right,
    };
  });

/** The text size of the page as a learner sets it in the browser: 100 percent, and a larger one. */
const TEXT_SIZES = [100, 130] as const;

for (const size of TEXT_SIZES) {
  test.describe(`The suggestions of the sheet in German at 320px and ${size} percent text`, () => {
    test.use({ viewport: { height: 640, width: 320 } });

    test("keep their labels inside their buttons", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* Effect.promise(async () => {
            await page.goto(GERMAN_LESSON);
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
            expect(Arr.map(read, (suggestion) => suggestion?.inside)).toEqual([
              true,
              true,
              true,
            ]);
            // At the ordinary size every label fits on one line, as it did before.
            if (size === 100) {
              expect(Arr.map(read, (suggestion) => suggestion?.height)).toEqual(
                [36, 36, 36]
              );
            }
          });
        })
      );
    });
  });
}
