import { describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
} from "@repo/backend/client/nina/uploads";
import { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import { Array as Arr, Effect } from "effect";
import {
  exceedsDocumentLimit,
  NAME_TAIL,
  rejectionNotice,
  splitFileName,
} from "@/components/ai/attachments";
import { aiTranslator, NO_BREAK } from "@/test/ai";

const MiB = 1024 * 1024;
/** One tenth of a MiB, rounded up to a whole byte. */
const TENTH_MIB = Math.ceil(MiB / 10);

function file(size: number, type: string) {
  return { size, type };
}

describe("message document limit", () => {
  it("accepts documents that total exactly 10 MiB", () => {
    expect(
      exceedsDocumentLimit([
        file(8 * MiB, "application/pdf"),
        file(2 * MiB, "text/plain"),
      ])
    ).toBe(false);
  });

  it("rejects documents that total 10.1 MiB", () => {
    expect(
      exceedsDocumentLimit([
        file(8 * MiB, "application/pdf"),
        file(2 * MiB + TENTH_MIB, "text/plain"),
      ])
    ).toBe(true);
  });

  it("ignores images of any size", () => {
    expect(
      exceedsDocumentLimit([
        file(12 * MiB, "image/png"),
        file(1 * MiB, "application/pdf"),
      ])
    ).toBe(false);
  });
});

describe("file name split", () => {
  it("keeps a short name whole at its end", () => {
    expect(splitFileName("notes.pdf")).toEqual({
      head: "",
      tail: "notes.pdf",
    });
  });

  it("gives away the start of a long name and keeps its end together", () => {
    const name = "Q3 Board Deck - FINAL (revised) v12 [approved by legal].pdf";

    const { head, tail } = splitFileName(name);

    expect(`${head}${tail}`).toBe(name);
    expect(tail).toBe(name.slice(-NAME_TAIL));
    expect(tail.endsWith(".pdf")).toBe(true);
  });

  it("never cuts inside a character the reader sees as one", () => {
    const technologist = "👩🏽‍💻";
    const head = "a".repeat(10);
    const rest = "b".repeat(NAME_TAIL - 1);

    expect(splitFileName(`${head}${technologist}${rest}`)).toEqual({
      head,
      tail: `${technologist}${rest}`,
    });
  });
});

/** A reason one pick was not attached in full, naming the files it dropped. */
const rejected = (
  code: PromptInputFileConstraintError["code"],
  files: readonly string[]
) => new PromptInputFileConstraintError({ code, files });

// Every language of the site is read, whichever languages that is.
describe("notice of the files that were not attached", () => {
  it.effect.each(APP_LOCALE_CODES)(
    "gives every reason its own words, with the limits the code checks, in %s",
    (locale) =>
      Effect.gen(function* () {
        const onError = vi.fn();
        const t = yield* aiTranslator(locale, onError);

        const notice = rejectionNotice(
          [
            rejected("accept", ["essay.docx"]),
            rejected("empty", ["empty.txt"]),
            rejected("max_file_size", ["report.pdf"]),
            rejected("max_files", ["extra.png"]),
          ],
          t
        );
        const reasons = Arr.map(notice.reasons, ({ reason }) => reason);
        const [, , size, count] = reasons;

        // A reason that misspells a number or needs one nobody passed fails to format.
        expect(onError).not.toHaveBeenCalled();
        expect(Arr.dedupe(reasons)).toHaveLength(4);
        expect(size).toContain(String(NINA_FILE_MEBIBYTES));
        expect(count).toContain(String(NINA_FILE_COUNT));
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "keeps each number with its unit or its noun on one line, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* aiTranslator(locale);

        const [size, count] = Arr.map(
          rejectionNotice(
            [
              rejected("max_file_size", ["report.pdf"]),
              rejected("max_files", ["extra.png"]),
            ],
            t
          ).reasons,
          ({ reason }) => reason
        );

        // The learner reads "10 MiB" and "10 files" as one word each, so a line
        // never ends between the number and what it counts.
        expect(size).toContain(`${NINA_FILE_MEBIBYTES}${NO_BREAK}`);
        expect(size).not.toContain(`${NINA_FILE_MEBIBYTES} `);
        expect(count).toContain(`${NINA_FILE_COUNT}${NO_BREAK}`);
        expect(count).not.toContain(`${NINA_FILE_COUNT} `);
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "says the same title for one file as for many, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* aiTranslator(locale);

        const one = rejectionNotice([rejected("empty", ["a.txt"])], t);
        const many = rejectionNotice(
          [
            rejected("accept", ["a.docx", "b.docx"]),
            rejected("max_file_size", ["c.pdf"]),
          ],
          t
        );

        expect(one.title).toBe(many.title);
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "names every file of a reason, however many, and counts none of them, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* aiTranslator(locale);
        const dropped = Arr.makeBy(25, (index) => `${index}.png`);

        const notice = rejectionNotice([rejected("max_files", dropped)], t);

        expect(notice.reasons).toEqual([
          { names: dropped, reason: expect.any(String) },
        ]);
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "lists two files of one name once, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* aiTranslator(locale);

        const [reason] = rejectionNotice(
          [rejected("empty", ["a.txt", "a.txt", "b.txt"])],
          t
        ).reasons;

        expect(reason?.names).toEqual(["a.txt", "b.txt"]);
      })
  );
});
