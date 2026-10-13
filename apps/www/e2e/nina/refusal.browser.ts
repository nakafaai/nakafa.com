import { expect, type Page, test } from "@playwright/test";
import { NINA_PROMPT_LENGTH } from "@repo/backend/client/nina/prompt";
import { Effect, Schema } from "effect";
import {
  composerOf,
  GERMAN,
  noticeWith,
  write,
} from "@/e2e/support/attachment";
import { onThePage, openChatPage, runOnPage, START } from "@/e2e/support/chat";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForSlide } from "@/e2e/support/layout";
import { SHEET_POPUP } from "@/e2e/support/selector";
import { UNCONFIRMED } from "@/e2e/support/sheet";

/** The limit of a prompt as the English notice writes it. */
const LIMIT = `at most ${new Intl.NumberFormat("en").format(NINA_PROMPT_LENGTH)} characters`;
/** The failures the server names, as the page receives them. */
const TOO_LONG = {
  _tag: "NinaPromptError",
  code: "NINA_PROMPT_LENGTH",
  message: "Shorten the message.",
};
const NO_CREDITS = {
  _tag: "NinaCreditError",
  code: "INSUFFICIENT_CREDITS",
  message: "Not enough credits.",
};

/** Waits until the page has painted twice, so what a press queued is on the page. */
const afterPaint = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

/** The arguments of a call that starts a chat: the words of the prompt. */
const StartArguments = Schema.Tuple([
  Schema.Struct({
    input: Schema.Struct({ prompt: Schema.Struct({ text: Schema.String }) }),
  }),
]);

test.describe("A prompt over the limit at 390px", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("is refused before the server is asked", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        const tooLong = "a".repeat(NINA_PROMPT_LENGTH + 1);
        const fits = "A question that fits";

        yield* write(composer, tooLong);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(noticeWith(page, LIMIT)).toBeVisible();
          // The words stay for the learner to shorten.
          await expect(composerOf(composer)).toHaveValue(tooLong);
          // Enter pressed again says it in the same notice, not in a stack of
          // copies beside it.
          await composerOf(composer).press("Enter");
          await composerOf(composer).press("Enter");
          await afterPaint(page);
          await expect(noticeWith(page, LIMIT)).toHaveCount(1);
        });

        // The prompt that fits is the first the server hears of: the calls
        // reach the server in the order they were sent.
        changes.failNext(START);
        yield* write(composer, fits);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect
            .poll(() => changes.argumentsOf(START).length)
            .toBeGreaterThan(0);
        });
        const heard = yield* Effect.forEach(
          changes.argumentsOf(START),
          (args) =>
            Schema.decodeUnknownEffect(StartArguments)(args).pipe(
              Effect.map(([argument]) => argument.input.prompt.text)
            )
        );
        yield* Effect.sync(() => {
          expect(heard).toEqual([fits]);
        });
      })
    );
  });

  test("that the server refuses reads as the length, not as a lost connection", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* write(composer, "A question the server finds too long");
        changes.failNext(START, TOO_LONG);

        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(noticeWith(page, LIMIT)).toBeVisible();
          await expect(noticeWith(page, UNCONFIRMED)).toHaveCount(0);
          await expect(composerOf(composer)).toHaveValue(
            "A question the server finds too long"
          );
        });
      })
    );
  });
});

/**
 * How much of the composer a notice covers, in the page: the area where the
 * notice overlaps the text box and the send button, in square pixels.
 */
const readCover = (notice: HTMLElement, names: readonly string[]) => {
  const form = document.querySelector(
    '[data-slot="sheet-popup"][data-open] form'
  );
  if (!form) {
    return null;
  }
  const box = notice.getBoundingClientRect();
  const covered = (element: Element | null) => {
    if (!element) {
      return -1;
    }
    const rect = element.getBoundingClientRect();
    const width =
      Math.min(box.right, rect.right) - Math.max(box.left, rect.left);
    const height =
      Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top);
    return Math.max(0, width) * Math.max(0, height);
  };
  const [input, send] = names;
  return {
    send: covered(form.querySelector(`button[aria-label="${send}"]`)),
    text: covered(form.querySelector(`textarea[aria-label="${input}"]`)),
  };
};

/** The refusals whose German sentence the sheet places, as the server names them. */
const GERMAN_REFUSALS = [
  { failure: NO_CREDITS, reason: "credits", sentence: "Deine Credits reichen" },
  {
    failure: TOO_LONG,
    reason: "its length",
    // German writes 100,000 as 100.000.
    sentence: `Kürze die Nachricht auf höchstens ${new Intl.NumberFormat("de").format(NINA_PROMPT_LENGTH)} Zeichen`,
  },
];

for (const { failure, reason, sentence } of GERMAN_REFUSALS) {
  test.describe(`A prompt refused for ${reason} in German at 320px`, () => {
    test.use({ viewport: { height: 640, width: 320 } });
    test.describe.configure({ timeout: 180_000 });

    test("tells the learner without covering the text box or the send button", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin, "de");
          // A lesson of the German site, where Nina's sheet opens over the page.
          yield* Effect.promise(async () => {
            await page.goto(pinnedRoutes.exponent.de);
            await page
              .getByRole("button", { exact: true, name: "Nina fragen" })
              .click();
          });
          const composer = page.locator(SHEET_POPUP);
          yield* waitForSlide(composer);
          yield* write(composer, "Erkläre mir die Ableitung", GERMAN);
          changes.failNext(START, failure);
          yield* Effect.promise(() =>
            composerOf(composer, GERMAN).press("Enter")
          );
          const notice = noticeWith(page, sentence);
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(async () => {
            await expect(notice).toBeVisible();
            await expect(notice).toHaveAttribute("data-mounted", "true");
          });
          yield* waitForSlide(notice);

          const cover = yield* Effect.promise(() =>
            notice.evaluate(readCover, [GERMAN.input, GERMAN.send])
          );
          yield* Effect.sync(() => {
            expect(cover).toEqual({ send: 0, text: 0 });
          });
        })
      );
    });
  });
}
