import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, HashSet, Order } from "effect";
import {
  chipsIn,
  chipsOfComposer,
  composerOf,
  fileOf,
  NO_BORDER,
  noticeWith,
  pickFiles,
  pictureOf,
  write,
} from "@/e2e/support/attachment";
import { saved } from "@/e2e/support/changes";
import { onThePage, openChatPage, runOnPage, START } from "@/e2e/support/chat";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
  UNAVAILABLE,
  UNCONFIRMED,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  RELEASE,
  SAVE,
  uploadsNamedBy,
  uploadsReleasedBy,
} from "@/e2e/support/upload";

/** What the pages tell the learner when the server calls an upload invalid. */
const INVALID = en.Ai.failures["attachment-invalid"];
/** The failure the server names when an upload is gone or is not the learner's. */
const INVALID_UPLOAD = {
  _tag: "NinaUploadError",
  code: "NINA_UPLOAD_INVALID",
  message: "Refused by the test.",
};

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
        const released = yield* uploadsReleasedBy(changes);
        yield* Effect.sync(() => {
          expect(released).toHaveLength(2);
          expect(HashSet.size(HashSet.fromIterable(released))).toBe(2);
        });
      })
    );
  });

  test("a second send after a refusal uploads nothing twice and names the uploads of the first", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* pickFiles(composer, [
          fileOf("report.pdf", "application/pdf", 12),
          fileOf("notes.txt", "text/plain", 12),
        ]);
        yield* write(composer, "Explain these files");

        // The server refuses the first send, so both files stay in the
        // composer, each holding the upload that carried it.
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(noticeWith(page, UNCONFIRMED)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsIn(composer)).toHaveCount(2);
        });

        // The same words and files go again, and the server refuses them too.
        const before = changes.sent;
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect
            .poll(() => changes.argumentsOf(START).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(2);
          await saved(changes, before);
        });
        const named = yield* uploadsNamedBy(changes);

        yield* Effect.sync(() => {
          expect(changes.argumentsOf(SAVE)).toHaveLength(2);
          expect(named).toHaveLength(2);
          expect(named[1]).toEqual(named[0]);
        });
      })
    );
  });

  test("an upload the server calls invalid goes back with the others, and the next send uploads the files again", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* pickFiles(composer, [
          fileOf("report.pdf", "application/pdf", 12),
          fileOf("notes.txt", "text/plain", 12),
        ]);
        yield* write(composer, "Explain these files");

        // Both files upload, then the server calls an upload invalid.
        const before = changes.sent;
        changes.failNext(START, INVALID_UPLOAD);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(noticeWith(page, INVALID)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect
            .poll(() => changes.argumentsOf(RELEASE).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(2);
          await saved(changes, before);
          await expect(chipsIn(composer)).toHaveCount(2);
        });
        const [named] = yield* uploadsNamedBy(changes);
        const released = yield* uploadsReleasedBy(changes);

        // No upload is held for the files now, so the next send makes two new ones.
        const resent = changes.sent;
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          // Both files upload again before the server is asked.
          await expect
            .poll(() => changes.argumentsOf(START).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(2);
          await saved(changes, resent);
        });
        const [, again] = yield* uploadsNamedBy(changes);

        yield* Effect.sync(() => {
          // The uploads the refused send named are the ones given back, and
          // the next send uploaded both files again.
          expect(Arr.sort(released, Order.String)).toEqual(
            Arr.sort(named ?? [], Order.String)
          );
          expect(changes.argumentsOf(SAVE)).toHaveLength(4);
          expect(Arr.intersection(named ?? [], again ?? [])).toEqual([]);
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
          // The composer shows no chip while its file uploads, so no upload
          // can be removed before the server holds a place for it.
          await expect(
            composer.getByRole("button", { name: "Remove report.pdf" })
          ).toHaveCount(0);
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
          await expect(chipsOfComposer(composer).first()).toHaveCSS(
            "border-top-color",
            NO_BORDER
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
          // The failure is the one thing a chip still draws a border for.
          await expect(chipsOfComposer(composer).first()).not.toHaveCSS(
            "border-top-color",
            NO_BORDER
          );
        });
      })
    );
  });
});

/** The popup of Nina's sheet, which stays in the page while the sheet is closed. */
const sheetPopup = (page: Page) => page.locator('[data-slot="sheet-popup"]');

/** A chat the sheet opens from its history, and the words the learner sends to it with a picture. */
const CONVERSATION = {
  prompt: "What is in this picture?",
  title: "About pictures",
};
const PICTURE_PROMPT = "Describe the picture";

test.describe("Uploads of a composer in the sheet at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("a chip shows its failed upload after the sheet closed and opened again, and a new file shows its own state alone", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        yield* openSheet(page);
        yield* pickFiles(inTheSheet(page), [
          fileOf("report.pdf", "application/pdf", 12),
        ]);
        yield* write(inTheSheet(page), "Summarize this report");

        // The learner closes the sheet while the upload is on its way. A hidden
        // composer gives back the preview address of each file, and a shown one
        // makes a new address, so the failure that comes next is found by the
        // id of the file or not at all: a chip that reads the new address finds
        // no failure and shows the file as done.
        changes.hold();
        changes.failNext(SAVE);
        yield* Effect.promise(async () => {
          await composerOf(inTheSheet(page)).press("Enter");
          await expect
            .poll(() => changes.argumentsOf(SAVE).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(1);
          await inTheSheet(page).getByRole("button", { name: "Close" }).click();
          await expect(composerOf(sheetPopup(page))).toBeHidden();
        });

        // The upload fails while the sheet is closed. The notice covers the
        // entry for a moment, and a press that lands on it holds it there for
        // as long as the pointer stays, so the press waits for it to go.
        changes.release();
        yield* Effect.promise(async () => {
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
            timeout: readinessTimeoutMilliseconds,
          });
          await page
            .getByRole("button", { exact: true, name: "Ask Nina" })
            .click();
          await expect(chipsIn(inTheSheet(page)).first()).toHaveAttribute(
            "data-state",
            "error",
            { timeout: readinessTimeoutMilliseconds }
          );
        });

        // Removing the chip takes the failure with it. A new file that is sent
        // shows its own state alone: on its way, and then uploaded.
        yield* Effect.promise(async () => {
          await inTheSheet(page)
            .getByRole("button", { name: "Remove report.pdf" })
            .click();
          await expect(chipsIn(inTheSheet(page))).toHaveCount(0);
        });
        yield* pickFiles(inTheSheet(page), [
          fileOf("notes.txt", "text/plain", 12),
        ]);
        changes.hold();
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(inTheSheet(page)).press("Enter");
          await expect(chipsIn(inTheSheet(page))).toHaveCount(1);
          await expect(chipsIn(inTheSheet(page)).first()).toHaveAttribute(
            "data-state",
            "uploading"
          );
        });
        changes.release();
        yield* Effect.promise(async () => {
          // The server refuses the prompt once the file is up, so the file is
          // back in the composer, uploaded, and nothing says failed.
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsIn(inTheSheet(page))).toHaveCount(1);
          await expect(chipsIn(inTheSheet(page)).first()).toHaveAttribute(
            "data-state",
            "done"
          );
        });
      })
    );
  });

  test("a message sent again from a chat the sheet shows after it closed shows its picture at the address the composer gives it now", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(CONVERSATION.prompt);
        yield* learner.titleNewest([CONVERSATION.title]);
        const picture = yield* pictureOf(page, "nina.png", {
          height: 64,
          width: 64,
        });

        yield* openSheet(page);
        yield* openFromHistory(page, CONVERSATION.title);
        yield* Effect.promise(async () => {
          await expect(
            promptWith(inTheSheet(page), CONVERSATION.prompt)
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          await expect(inTheSheet(page).getByText(UNAVAILABLE)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
        yield* pickFiles(inTheSheet(page), [picture]);
        yield* write(inTheSheet(page), PICTURE_PROMPT);

        // The server refuses the message once the picture has uploaded, so the
        // picture stays in the composer and keeps its upload. The learner closes
        // the sheet, which hides the composer, and opens it again.
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(inTheSheet(page)).press("Enter");
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chipsOfComposer(inTheSheet(page))).toHaveCount(1);
          await inTheSheet(page).getByRole("button", { name: "Close" }).click();
          await expect(composerOf(sheetPopup(page))).toBeHidden();
          // The notice covers the entry to the sheet for a moment, so the press waits for it to go.
          await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
            timeout: readinessTimeoutMilliseconds,
          });
          await page
            .getByRole("button", { exact: true, name: "Ask Nina" })
            .click();
        });

        // The same words go again with the same picture, which is not uploaded
        // again. The message shows the picture at the address its composer has now.
        yield* write(inTheSheet(page), PICTURE_PROMPT);
        // The composer hides a chip while its send is pending, so the address
        // of the picture is read before the send.
        const shown = yield* Effect.promise(async () => {
          const chip = chipsOfComposer(inTheSheet(page)).getByRole("img", {
            name: "nina.png",
          });
          await expect(chip).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          return chip.getAttribute("src");
        });
        changes.hold();
        changes.failNext(START);
        yield* Effect.promise(() =>
          composerOf(inTheSheet(page)).press("Enter")
        );
        const sentPicture = inTheSheet(page)
          .locator('[data-slot="message"]')
          .getByRole("img", { name: "nina.png" });
        yield* Effect.promise(async () => {
          await expect
            .poll(() => changes.argumentsOf(START).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(2);
          await expect(
            promptWith(inTheSheet(page), PICTURE_PROMPT)
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          await expect(sentPicture).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(sentPicture).toHaveAttribute("src", shown ?? "");
          await expect
            .poll(
              () =>
                sentPicture.evaluate(
                  (image: HTMLImageElement) => image.naturalWidth
                ),
              { timeout: readinessTimeoutMilliseconds }
            )
            .toBeGreaterThan(0);
        });
        changes.release();
      })
    );
  });
});
