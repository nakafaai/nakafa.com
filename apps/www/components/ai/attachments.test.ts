import { describe, expect, it } from "@effect/vitest";
import {
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
} from "@repo/backend/client/nina/uploads";
import { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import de from "@repo/internationalization/dictionaries/de.json";
import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { Array as Arr } from "effect";
import { createTranslator } from "next-intl";
import {
  exceedsDocumentLimit,
  NAME_TAIL,
  rejectionNotice,
  splitFileName,
} from "@/components/ai/attachments";

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
) => new PromptInputFileConstraintError({ code, files, message: code });

describe("notice of the files that were not attached", () => {
  // Indonesian has one form for any count, so it words one file and two alike.
  for (const [locale, messages, pluralForms] of [
    ["en", en, true],
    ["de", de, true],
    ["id", id, false],
  ] as const) {
    it(`words every reason with the limits the code checks, in ${locale}`, () => {
      const onError = vi.fn();
      const t = createTranslator({
        locale,
        messages,
        namespace: "Ai",
        onError,
      });

      const notice = rejectionNotice(
        [
          rejected("accept", ["essay.docx"]),
          rejected("empty", ["empty.txt"]),
          rejected("max_file_size", ["report.pdf", "scan.pdf"]),
          rejected(
            "max_files",
            Arr.makeBy(5, (index) => `${index}.png`)
          ),
        ],
        t
      );
      const [type, empty, size, count] = notice.reasons;

      // A sentence that misspells a number or needs one nobody passed fails to format.
      expect(onError).not.toHaveBeenCalled();
      // One file of each of the first three reasons and two more of the last.
      expect(notice.title).toContain("9");
      expect(size?.sentence).toContain(String(NINA_FILE_MEBIBYTES));
      expect(count?.sentence).toContain(String(NINA_FILE_COUNT));
      // A notice lists three names for a reason, then counts the rest.
      expect(count?.names).toEqual(["0.png", "1.png", "2.png"]);
      expect(count?.more).toContain("2");
      expect([type?.more, empty?.more, size?.more]).toEqual([null, null, null]);
      // The sentence follows the count of files it speaks of.
      const [emptyFiles] = rejectionNotice(
        [rejected("empty", ["a.txt", "b.txt"])],
        t
      ).reasons;
      expect(emptyFiles?.sentence === empty?.sentence).toBe(!pluralForms);
    });
  }
});
