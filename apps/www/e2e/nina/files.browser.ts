import { expect, type Locator, test } from "@playwright/test";
import {
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
  NINA_FILE_SIZE,
  NINA_FILENAME_LENGTH,
} from "@repo/backend/client/nina/uploads";
import { Array as Arr, Effect } from "effect";
import {
  chipsIn,
  fileOf,
  noticeWith,
  openComposer,
  pickFiles,
  runPage,
  WORD_TYPE,
} from "@/e2e/support/attachment";
import { waitForSlide } from "@/e2e/support/layout";

/** The sentence that says which files Nina reads. */
const TYPES = "Nina reads PNG, JPEG, WebP, GIF, PDF, and text files.";

/** The part of a notice that gives one reason, with the files it dropped. */
const reasonIn = (notice: Locator, sentence: string) =>
  notice.getByRole("listitem").filter({ hasText: sentence });

/** Whether a notice lies inside the page and every name in it fits its line, read in the page. */
const readNotice = (notice: HTMLElement) => {
  const box = notice.getBoundingClientRect();
  // The reasons are the items of a list, and each reason lists its names.
  const names = Array.from(notice.querySelectorAll("ul > li > ul > li"));
  return {
    inside: box.left >= 0 && box.right <= innerWidth,
    namesFit: names.every((name) => name.scrollWidth <= name.clientWidth),
    namesShown: names.length,
  };
};

const photo = (name: string) => fileOf(name, "image/png", 1);

for (const width of [320, 1440]) {
  test.describe(`Choosing files at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("names every file Nina did not take, with its reason", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [
            photo("lesson.png"),
            fileOf("essay.docx", WORD_TYPE, 20),
            fileOf("report.pdf", "application/pdf", NINA_FILE_SIZE + 1),
            fileOf("empty.txt", "text/plain", 0),
          ]);

          // The photo is the only file attached. One notice names the other
          // three, each under the reason it was not attached.
          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(1);
            const notice = noticeWith(page, "not attached");
            await expect(notice).toHaveCount(1);
            await expect(notice).toContainText("3 files were not attached.");
            await expect(reasonIn(notice, TYPES)).toContainText("essay.docx");
            await expect(
              reasonIn(notice, `larger than ${NINA_FILE_MEBIBYTES} MiB`)
            ).toContainText("report.pdf");
            await expect(reasonIn(notice, "is empty")).toContainText(
              "empty.txt"
            );
            await expect(reasonIn(notice, TYPES)).not.toContainText(
              "report.pdf"
            );
          });
        })
      );
    });

    test("names the files that do not fit the count", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          const surplus = ["last-1.png", "last-2.png"];
          yield* pickFiles(composer, [
            ...Arr.makeBy(NINA_FILE_COUNT, (index) =>
              photo(`photo-${index + 1}.png`)
            ),
            ...Arr.map(surplus, photo),
          ]);

          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(NINA_FILE_COUNT);
            const reason = reasonIn(
              noticeWith(page, "not attached"),
              `A message holds at most ${NINA_FILE_COUNT} files.`
            );
            await expect(reason).toContainText("last-1.png");
            await expect(reason).toContainText("last-2.png");
          });
        })
      );
    });

    test("keeps a notice inside the page when a name is the longest the backend stores", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          const name = `${"a".repeat(NINA_FILENAME_LENGTH - ".docx".length)}.docx`;
          yield* pickFiles(composer, [fileOf(name, WORD_TYPE, 20)]);
          const notice = noticeWith(page, "not attached");
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(() =>
            expect(notice).toHaveAttribute("data-mounted", "true")
          );
          yield* waitForSlide(notice);
          const read = yield* Effect.promise(() => notice.evaluate(readNotice));

          yield* Effect.sync(() => {
            expect(read).toEqual({
              inside: true,
              namesFit: true,
              namesShown: 1,
            });
          });
        })
      );
    });

    test("reports an empty file as empty, not as too large", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [fileOf("empty.txt", "text/plain", 0)]);

          yield* Effect.promise(async () => {
            const notice = noticeWith(page, "not attached");
            await expect(reasonIn(notice, "is empty")).toContainText(
              "empty.txt"
            );
            await expect(chipsIn(composer)).toHaveCount(0);
            await expect(notice).not.toContainText("larger than");
          });
        })
      );
    });
  });
}
