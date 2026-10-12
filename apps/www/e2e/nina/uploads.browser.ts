import { expect, type Page, test } from "@playwright/test";
import { Effect, HashSet, Schema } from "effect";
import {
  chipsIn,
  composerOf,
  fileOf,
  pickFiles,
  pictureOf,
  write,
} from "@/e2e/support/attachment";
import { saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Convex names of the upload functions the composer calls. */
const SAVE = "nina/uploads:save";
const RELEASE = "nina/uploads:release";
/** What the pages tell the learner when a prompt could not be confirmed. */
const UNCONFIRMED =
  "We could not confirm the request. Check your connection and try again.";

/** The new chat page, where the first prompt of a chat is written. */
const onThePage = (page: Page) => page.locator("main main");

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
});
