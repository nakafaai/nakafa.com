import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, HashSet, Order, Schema } from "effect";
import {
  chipsIn,
  composerOf,
  fileOf,
  noticeWith,
  pickFiles,
  pictureOf,
  write,
} from "@/e2e/support/attachment";
import { type Changes, saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Convex names of the upload functions the composer calls. */
const SAVE = "nina/uploads:save";
const RELEASE = "nina/uploads:release";
/** What the pages tell the learner when a prompt could not be confirmed. */
const UNCONFIRMED =
  "We could not confirm the request. Check your connection and try again.";
/** What the pages tell the learner when the server calls an upload invalid. */
const INVALID = "An attachment is invalid or no longer available";
/** The failure the server names when an upload is gone or is not the learner's. */
const INVALID_UPLOAD = {
  _tag: "NinaUploadError",
  code: "NINA_UPLOAD_INVALID",
  message: "Refused by the test.",
};

/** The new chat page, where the first prompt of a chat is written. */
const onThePage = (page: Page) => page.locator("main main");

/** The arguments of a call that releases one upload. */
const ReleaseArguments = Schema.Tuple([
  Schema.Struct({ uploadId: Schema.String }),
]);
/** The arguments of a call that starts a turn: the uploads it names. */
const StartArguments = Schema.Tuple([
  Schema.Struct({
    input: Schema.Struct({
      prompt: Schema.Struct({ uploadIds: Schema.Array(Schema.String) }),
    }),
  }),
]);

/** The uploads each call that started a turn named, in the order the calls were sent. */
const uploadsNamedBy = (changes: Changes) =>
  Effect.forEach(changes.argumentsOf(START), (args) =>
    Schema.decodeUnknownEffect(StartArguments)(args).pipe(
      Effect.map(([argument]) => argument.input.prompt.uploadIds)
    )
  );

/** The uploads the page gave back, in the order it did. */
const uploadsReleasedBy = (changes: Changes) =>
  Effect.forEach(changes.argumentsOf(RELEASE), (args) =>
    Schema.decodeUnknownEffect(ReleaseArguments)(args).pipe(
      Effect.map(([argument]) => argument.uploadId)
    )
  );

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
          await expect.poll(() => changes.argumentsOf(START).length).toBe(2);
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
          await expect.poll(() => changes.argumentsOf(RELEASE).length).toBe(2);
          await saved(changes, before);
          await expect(chipsIn(composer)).toHaveCount(2);
        });
        const [named] = yield* uploadsNamedBy(changes);
        const released = yield* uploadsReleasedBy(changes);

        // The uploads the refused send named are the ones given back.
        yield* Effect.sync(() => {
          expect(Arr.sort(released, Order.String)).toEqual(
            Arr.sort(named ?? [], Order.String)
          );
        });

        // Nothing holds an upload for the files now, so the next send makes
        // two new ones.
        const resent = changes.sent;
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect.poll(() => changes.argumentsOf(START).length).toBe(2);
          await saved(changes, resent);
        });
        const [, again] = yield* uploadsNamedBy(changes);

        yield* Effect.sync(() => {
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
