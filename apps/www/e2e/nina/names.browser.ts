import { expect, test } from "@playwright/test";
import { NINA_FILENAME_LENGTH } from "@repo/backend/client/nina/uploads";
import { Effect } from "effect";
import {
  chipsIn,
  chipsOfMessages,
  composerOf,
  fileOf,
  openComposer,
  pickFiles,
  runPage,
  write,
} from "@/e2e/support/attachment";
import { onThePage, openChatPage, runOnPage } from "@/e2e/support/chat";

/** Names a learner can have on a file, longer than a title can show. */
const LONG_NAMES = [
  {
    label: "a board deck",
    name: "Q3 Board Deck - FINAL (revised) v12 [approved by legal].pdf",
  },
  {
    label: "a camera file",
    name: "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC",
  },
  {
    // The longest name the backend stores, with nowhere to break the line.
    label: "the longest name the backend stores",
    name: `${"a".repeat(NINA_FILENAME_LENGTH - ".pdf".length)}.pdf`,
  },
];
/** Names that end in characters wider than letters. */
const WIDE_NAMES = [
  { label: "emoji", name: `Party photos ${"🎉".repeat(14)}.pdf` },
  { label: "Chinese", name: "期末考试复习资料大全最终修订版第三稿.pdf" },
];
/** A name that fits whole, as most names do. */
const ORDINARY_NAME = "notes.pdf";

/** What a chip's title shows of its name, and what the pointer is on at the middle of the chip, read in the page. */
const readName = (chip: HTMLElement) => {
  const title = chip.querySelector('[data-slot="attachment-title"]');
  const head = title?.firstElementChild;
  const tail = title?.lastElementChild;
  if (!(title && head && tail)) {
    return null;
  }
  const box = chip.getBoundingClientRect();
  const under = document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2
  );
  return {
    chipInside: box.left >= 0 && box.right <= innerWidth,
    headVisible: head.getBoundingClientRect().width > 0,
    tailCut: tail.scrollWidth > tail.clientWidth,
    tailInside:
      tail.getBoundingClientRect().right <=
      title.getBoundingClientRect().right + 0.5,
    underPointer: under?.getAttribute("title") ?? null,
  };
};

/** The title of a chip that holds a long name: its start and its end both in view. */
const longNameShown = (name: string) => ({
  chipInside: true,
  headVisible: true,
  tailCut: false,
  tailInside: true,
  underPointer: name,
});

for (const width of [320, 1440]) {
  test.describe(`Names on document chips at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const { label, name } of LONG_NAMES) {
      test(`keep the start and the end of ${label} in view`, async ({
        page,
      }) => {
        await runPage(
          page,
          Effect.gen(function* () {
            const composer = yield* openComposer(page);
            yield* pickFiles(composer, [fileOf(name, "text/plain", 8)]);
            const chip = chipsIn(composer).first();
            yield* Effect.promise(() => expect(chip).toBeVisible());
            const read = yield* Effect.promise(() => chip.evaluate(readName));

            yield* Effect.sync(() => {
              expect(read).toEqual(longNameShown(name));
            });
          })
        );
      });
    }

    for (const { label, name } of WIDE_NAMES) {
      test(`that end in ${label} stay inside their chip`, async ({ page }) => {
        await runPage(
          page,
          Effect.gen(function* () {
            const composer = yield* openComposer(page);
            yield* pickFiles(composer, [fileOf(name, "text/plain", 8)]);
            const chip = chipsIn(composer).first();
            yield* Effect.promise(() => expect(chip).toBeVisible());
            const read = yield* Effect.promise(() => chip.evaluate(readName));

            yield* Effect.sync(() => {
              expect(read).toMatchObject({
                chipInside: true,
                tailInside: true,
                underPointer: name,
              });
            });
          })
        );
      });
    }

    test("show an ordinary name whole", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [fileOf(ORDINARY_NAME, "text/plain", 8)]);
          const chip = chipsIn(composer).first();
          yield* Effect.promise(() => expect(chip).toBeVisible());
          const read = yield* Effect.promise(() => chip.evaluate(readName));

          // The name is all in its end, so there is no start left to show.
          yield* Effect.sync(() => {
            expect(read).toEqual({
              chipInside: true,
              headVisible: false,
              tailCut: false,
              tailInside: true,
              underPointer: ORDINARY_NAME,
            });
          });
        })
      );
    });
  });
}

/**
 * How far a chip runs past the inner edge of its row, in pixels. The row's
 * padding and border lie outside that edge, so a chip that fits gives zero or
 * less.
 */
const readOverhang = (chip: HTMLElement) => {
  const row = chip.closest('[data-slot="attachment-group"]');
  if (!(row instanceof HTMLElement)) {
    return null;
  }
  const style = getComputedStyle(row);
  const inner =
    row.getBoundingClientRect().right -
    Number.parseFloat(style.paddingRight) -
    Number.parseFloat(style.borderRightWidth);
  return chip.getBoundingClientRect().right - inner;
};

// A document chip stays inside its row at every width. Its 16rem cap and its
// 10rem minimum both give way to a row narrower than they are, and 200px is
// narrower than any phone, where the minimum is the one that would overhang.
for (const width of [300, 200]) {
  test.describe(`Document chips inside their row at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const { label, name } of LONG_NAMES) {
      test(`keep ${label} inside the end of the row`, async ({ page }) => {
        await runPage(
          page,
          Effect.gen(function* () {
            const composer = yield* openComposer(page);
            yield* pickFiles(composer, [fileOf(name, "text/plain", 8)]);
            const chip = chipsIn(composer).first();
            yield* Effect.promise(() => expect(chip).toBeVisible());
            const overhang = yield* Effect.promise(() =>
              chip.evaluate(readOverhang)
            );

            yield* Effect.sync(() => {
              expect(overhang).toBeLessThanOrEqual(0.5);
            });
          })
        );
      });
    }
  });
}

test.describe("Names on the files of a sent message at 320px", () => {
  test.use({ viewport: { height: 900, width: 320 } });
  test.describe.configure({ timeout: 180_000 });

  for (const { label, name } of LONG_NAMES) {
    test(`keep the start and the end of ${label} in view`, async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);
          const composer = onThePage(page);
          yield* pickFiles(composer, [fileOf(name, "text/plain", 8)]);
          yield* write(composer, "Read this file");

          // The server's answers are held back, so the page keeps the message
          // it showed at once, with its file in it.
          changes.hold();
          yield* Effect.promise(async () => {
            await composerOf(composer).press("Enter");
            await expect(chipsOfMessages(page).first()).toBeVisible();
          });
          const read = yield* Effect.promise(() =>
            chipsOfMessages(page).first().evaluate(readName)
          );

          yield* Effect.sync(() => {
            expect(read).toEqual(longNameShown(name));
          });
        })
      );
    });
  }
});
