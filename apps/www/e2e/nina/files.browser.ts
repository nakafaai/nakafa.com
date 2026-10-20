import { expect, type Locator, test } from "@playwright/test";
import {
  NINA_FILE_COUNT,
  NINA_FILE_SIZE,
} from "@repo/backend/client/nina/uploads";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import {
  chipsIn,
  ENGLISH,
  fileOf,
  openComposer,
  photo,
  pickFiles,
  refusedChipsIn,
  runPage,
  WORD_TYPE,
  write,
} from "../support/attachment";
import { openChatPage, runOnPage } from "../support/chat";
import { inTheSheet, openSheet } from "../support/sheet";

/** The English reasons a refused chip gives, as the site words them. */
const REJECTIONS = en.Ai["attachment-rejections"];
const TYPES = REJECTIONS.type;
const LARGER = REJECTIONS.size;
const MANY = REJECTIONS.count.replace(
  "{count, number}",
  String(NINA_FILE_COUNT)
);

/** The refused chip of one file, found by its name. */
const refusedChip = (composer: Locator, name: string) =>
  refusedChipsIn(composer).filter({ hasText: name });

test.describe("Files that a pick does not attach", () => {
  test("show one refused chip per file with its reason, and attach the rest without a toast", async ({
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

        yield* Effect.promise(async () => {
          // The photo is attached; the other three are refused chips in the tray.
          await expect(chipsIn(composer)).toHaveCount(4);
          await expect(refusedChipsIn(composer)).toHaveCount(3);
          await expect(refusedChip(composer, "essay.docx")).toContainText(
            TYPES
          );
          await expect(refusedChip(composer, "report.pdf")).toContainText(
            LARGER
          );
          await expect(refusedChip(composer, "empty.txt")).toContainText(
            REJECTIONS.empty
          );
          // A refusal is never a toast, so no toast shows the names.
          await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
        });
      })
    );
  });

  test("refuses the files beyond the count one by one, each with the count reason", async ({
    page,
  }) => {
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
          await expect(chipsIn(composer)).toHaveCount(NINA_FILE_COUNT + 2);
          await expect(refusedChipsIn(composer)).toHaveCount(2);
          await expect(refusedChip(composer, "last-1.png")).toContainText(MANY);
          await expect(refusedChip(composer, "last-2.png")).toContainText(MANY);
        });
      })
    );
  });

  test("removes a refused chip with its own button, and the next pick replaces the refused chips", async ({
    page,
  }) => {
    await runPage(
      page,
      Effect.gen(function* () {
        const composer = yield* openComposer(page);
        yield* pickFiles(composer, [
          photo("lesson.png"),
          fileOf("essay.docx", WORD_TYPE, 20),
        ]);

        yield* Effect.promise(async () => {
          await expect(refusedChip(composer, "essay.docx")).toHaveCount(1);
          await refusedChip(composer, "essay.docx")
            .getByRole("button", {
              name: en.Ai["remove-attachment"].replace(
                "{filename}",
                "essay.docx"
              ),
            })
            .click();
          await expect(refusedChipsIn(composer)).toHaveCount(0);
          // The photo the pick attached stays where it was.
          await expect(chipsIn(composer)).toHaveCount(1);
        });

        yield* pickFiles(composer, [
          fileOf("report.pdf", "application/pdf", NINA_FILE_SIZE + 1),
        ]);
        yield* Effect.promise(async () => {
          await expect(refusedChipsIn(composer)).toHaveCount(1);
          await expect(refusedChip(composer, "report.pdf")).toHaveCount(1);
        });
      })
    );
  });

  test("clears the refused chips when the message is sent, and never uploads them", async ({
    page,
  }) => {
    await runPage(
      page,
      Effect.gen(function* () {
        const composer = yield* openComposer(page);
        yield* pickFiles(composer, [
          photo("lesson.png"),
          fileOf("essay.docx", WORD_TYPE, 20),
        ]);
        yield* write(composer, "Explain the photo.");

        yield* Effect.promise(async () => {
          await expect(refusedChipsIn(composer)).toHaveCount(1);
          await composer.getByRole("button", { name: ENGLISH.send }).click();
          // The refused chip leaves with the message it was picked for.
          await expect(refusedChipsIn(composer)).toHaveCount(0);
        });
      })
    );
  });

  test("a suggestion that sends takes the refused chips with it", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        yield* openSheet(page);
        const sheet = inTheSheet(page);
        yield* pickFiles(sheet, [fileOf("essay.docx", WORD_TYPE, 20)]);

        yield* Effect.promise(async () => {
          await expect(refusedChipsIn(sheet)).toHaveCount(1);
          await sheet
            .getByRole("button", { name: en.Ai["suggestion-explain"] })
            .click();
          // The suggestion started a chat. A new chat shows the composer again,
          // and its refused chip must not have come back with it.
          await sheet
            .getByRole("button", { exact: true, name: en.Ai["new-chat"] })
            .click();
          await expect(refusedChipsIn(sheet)).toHaveCount(0);
        });
      })
    );
  });
});
