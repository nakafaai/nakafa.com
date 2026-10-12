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

/** The title of the notice, which names no count. */
const TITLE = "Files not attached";
/** The reason of a file that Nina does not read. */
const TYPES = "Only PNG, JPEG, WebP, GIF, PDF, and text files";

/** The part of a notice that gives one reason, with the files it dropped. */
const reasonIn = (notice: Locator, reason: string) =>
  notice.locator("dl > div").filter({ hasText: reason });

/**
 * Whether a notice lies inside the page, every name in it fits its line and
 * keeps its end in view, read in the page.
 */
const readNotice = (notice: HTMLElement) => {
  const box = notice.getBoundingClientRect();
  // The files of every reason are the descriptions of one list, and each name
  // is a start that gives way and an end that stays.
  const names = Array.from(notice.querySelectorAll("dd"));
  return {
    endsShown: names.every((name) => {
      const end = name.lastElementChild;
      return end !== null && end.scrollWidth <= end.clientWidth;
    }),
    inside: box.left >= 0 && box.right <= innerWidth,
    namesFit: names.every((name) => name.scrollWidth <= name.clientWidth),
    namesShown: names.length,
  };
};

/**
 * Whether a notice with a long list lies inside the page, keeps the reason of
 * the list in view, and lets the list show its last name once it is scrolled
 * to its end, read in the page. The read scrolls the list, so it comes last.
 */
const readList = (notice: HTMLElement) => {
  const list = notice.querySelector("dl");
  const reason = list?.querySelector("dt");
  const names = Array.from(notice.querySelectorAll("dd"));
  const last = names.at(-1);
  if (!(list && reason && last)) {
    return null;
  }
  const box = notice.getBoundingClientRect();
  const inList = (element: Element) => {
    const bounds = list.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5;
  };
  const reasonShown = inList(reason);
  list.scrollTop = list.scrollHeight;
  return {
    inside:
      box.top >= 0 &&
      box.bottom <= innerHeight &&
      box.left >= 0 &&
      box.right <= innerWidth,
    lastReachable: inList(last),
    names: names.length,
    reasonShown,
    scrolls: list.scrollHeight > list.clientHeight,
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
          // three, each with the reason it was not attached.
          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(1);
            const notice = noticeWith(page, TITLE);
            await expect(notice).toHaveCount(1);
            // The title says nothing of how many files: the names show it.
            await expect(notice.locator("[data-title]")).toHaveText(TITLE);
            await expect(reasonIn(notice, TYPES)).toContainText("essay.docx");
            await expect(
              reasonIn(notice, `Larger than ${NINA_FILE_MEBIBYTES} MiB`)
            ).toContainText("report.pdf");
            await expect(reasonIn(notice, "Empty file")).toContainText(
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
              noticeWith(page, TITLE),
              `At most ${NINA_FILE_COUNT} files per message`
            );
            await expect(reason).toContainText("last-1.png");
            await expect(reason).toContainText("last-2.png");
          });
        })
      );
    });

    test("names every file of a long pick, scrolls the list, and stays inside the page", async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          // Far more files than a notice shows without scrolling.
          const surplus = Arr.makeBy(25, (index) => `extra-${index + 1}.png`);
          yield* pickFiles(composer, [
            ...Arr.makeBy(NINA_FILE_COUNT, (index) =>
              photo(`photo-${index + 1}.png`)
            ),
            ...Arr.map(surplus, photo),
          ]);
          const notice = noticeWith(page, TITLE);
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(async () => {
            await expect(chipsIn(composer)).toHaveCount(NINA_FILE_COUNT);
            await expect(notice).toHaveAttribute("data-mounted", "true");
          });
          yield* waitForSlide(notice);
          const read = yield* Effect.promise(() => notice.evaluate(readList));

          // Every file that was dropped has a line, no line counts them, the
          // reason stays above the names, and the last name can be reached.
          yield* Effect.sync(() => {
            expect(read).toEqual({
              inside: true,
              lastReachable: true,
              names: surplus.length,
              reasonShown: true,
              scrolls: true,
            });
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
          const notice = noticeWith(page, TITLE);
          // The notice slides into place; its place is read once it stopped.
          yield* Effect.promise(() =>
            expect(notice).toHaveAttribute("data-mounted", "true")
          );
          yield* waitForSlide(notice);
          const read = yield* Effect.promise(() => notice.evaluate(readNotice));

          yield* Effect.sync(() => {
            expect(read).toEqual({
              endsShown: true,
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
            const notice = noticeWith(page, TITLE);
            await expect(reasonIn(notice, "Empty file")).toContainText(
              "empty.txt"
            );
            await expect(chipsIn(composer)).toHaveCount(0);
            await expect(notice).not.toContainText("Larger than");
          });
        })
      );
    });
  });
}
