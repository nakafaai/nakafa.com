import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, HashSet, Schema } from "effect";
import {
  chipsIn,
  fileOf,
  noticeWith,
  pickFiles,
  pictureOf,
} from "@/e2e/support/attachment";
import { saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import { waitForSlide } from "@/e2e/support/layout";
import { SHEET_POPUP } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Convex names of the upload functions the composer calls. */
const SAVE = "nina/uploads:save";
const RELEASE = "nina/uploads:release";
/** What the pages tell the learner when a prompt could not be confirmed. */
const UNCONFIRMED =
  "We could not confirm the request. Check your connection and try again.";
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

/** The new chat page, where the first prompt of a chat is written. */
const onThePage = (page: Page) => page.locator("main main");

/** The names of the composer's controls in English and in German. */
const ENGLISH = { input: "Ask Nina anything...", send: "Send message" };
const GERMAN = { input: "Frag Nina etwas...", send: "Nachricht senden" };

/** The box where the learner writes to Nina, in the language of the page. */
const composerOf = (scope: Locator, labels = ENGLISH) =>
  scope.getByRole("textbox", { name: labels.input });

/** Writes the prompt and waits until the page lets it be sent. */
const write = (scope: Locator, text: string, labels = ENGLISH) =>
  Effect.promise(async () => {
    await composerOf(scope, labels).fill(text);
    await expect(scope.getByRole("button", { name: labels.send })).toBeEnabled({
      timeout: readinessTimeoutMilliseconds,
    });
  });

/** The arguments of a call that releases one upload. */
const ReleaseArguments = Schema.Tuple([
  Schema.Struct({ uploadId: Schema.String }),
]);

test.describe("Uploads of a composer at 390px", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("removing a chip releases the upload it holds, and only that one", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        const picture = yield* pictureOf(page, "nina.png", {
          height: 64,
          width: 64,
        });
        yield* pickFiles(composer, [
          picture,
          fileOf("notes.txt", "text/plain", 12),
        ]);

        // Both files upload, then the server refuses the prompt, so both chips
        // stay in the composer and hold an upload.
        yield* write(composer, "Explain these files");
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsIn(composer)).toHaveCount(2);
        });

        // A file added after that has no upload: removing it asks for nothing.
        yield* pickFiles(composer, [fileOf("later.txt", "text/plain", 3)]);
        const before = changes.sent;
        yield* Effect.promise(async () => {
          await expect(chipsIn(composer)).toHaveCount(3);
          await composer
            .getByRole("button", { name: "Remove later.txt" })
            .click();
          await composer
            .getByRole("button", { name: "Remove nina.png" })
            .click();
          await composer
            .getByRole("button", { name: "Remove notes.txt" })
            .click();
          await expect(chipsIn(composer)).toHaveCount(0);
          await saved(changes, before);
        });
        const released = yield* Effect.forEach(
          changes.argumentsOf(RELEASE),
          (args) =>
            Schema.decodeUnknownEffect(ReleaseArguments)(args).pipe(
              Effect.map(([argument]) => argument.uploadId)
            )
        );
        yield* Effect.sync(() => {
          expect(released).toHaveLength(2);
          expect(HashSet.size(HashSet.fromIterable(released))).toBe(2);
        });
      })
    );
  });

  test("the message shows a file as uploading until the upload is done", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* pickFiles(composer, [
          fileOf("report.pdf", "application/pdf", 12),
        ]);
        yield* write(composer, "Summarize this report");

        // The upload is on its way, so the message shows its file as uploading.
        changes.hold();
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(chipsIn(composer).first()).toHaveAttribute(
            "data-state",
            "uploading"
          );
        });

        // Once it is done, the server refuses the prompt and the file is back
        // in the composer as an upload that finished.
        changes.failNext(START);
        changes.release();
        yield* Effect.promise(async () => {
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsIn(composer).first()).toHaveAttribute(
            "data-state",
            "done"
          );
        });
      })
    );
  });

  test("a chip whose upload failed says so", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* pickFiles(composer, [
          fileOf("report.pdf", "application/pdf", 12),
        ]);
        yield* write(composer, "Summarize this report");
        changes.failNext(SAVE);

        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsIn(composer).first()).toHaveAttribute(
            "data-state",
            "error"
          );
        });
      })
    );
  });

  test("a refusal for the length reads as the length, not as a lost connection", async ({
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
          await expect(
            noticeWith(page, "This message is too long")
          ).toBeVisible();
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

/** A lesson of the German site, where Nina's sheet opens over the page. */
const GERMAN_LESSON =
  "/de/faecher/mathematik/potenzen-und-logarithmen/grundlagen";

test.describe("A refused prompt in German at 320px", () => {
  test.use({ viewport: { height: 640, width: 320 } });
  test.describe.configure({ timeout: 180_000 });

  test("tells the learner without covering the text box or the send button", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin, "de");
        yield* Effect.promise(async () => {
          await page.goto(GERMAN_LESSON);
          await page
            .getByRole("button", { exact: true, name: "Nina fragen" })
            .click();
        });
        const composer = page.locator(SHEET_POPUP);
        yield* waitForSlide(composer);
        yield* write(composer, "Erkläre mir die Ableitung", GERMAN);
        changes.failNext(START, NO_CREDITS);
        yield* Effect.promise(() =>
          composerOf(composer, GERMAN).press("Enter")
        );
        const notice = noticeWith(page, "Deine Credits reichen");
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
