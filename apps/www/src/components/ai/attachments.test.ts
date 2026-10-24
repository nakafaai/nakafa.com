import { describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { NINA_FILE_COUNT } from "@repo/backend/client/nina/uploads";
import { Array as Arr, Effect } from "effect";
import {
  exceedsDocumentLimit,
  NAME_TAIL,
  refusalReason,
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

// Every language of the site is read, whichever languages that is.
describe("reason of a file that was not attached", () => {
  it.effect.each(APP_LOCALE_CODES)(
    "gives every reason its own short words, with the limit the code checks, in %s",
    (locale) =>
      Effect.gen(function* () {
        const onError = vi.fn();
        const t = yield* aiTranslator(locale, onError);

        const reasons = [
          refusalReason("accept", t),
          refusalReason("empty", t),
          refusalReason("max_file_size", t),
          refusalReason("max_files", t),
        ];

        // A reason that misspells a number or needs one nobody passed fails to format.
        expect(onError).not.toHaveBeenCalled();
        expect(Arr.dedupe(reasons)).toHaveLength(4);
        expect(reasons[3]).toContain(String(NINA_FILE_COUNT));
      })
  );

  it.effect.each(APP_LOCALE_CODES)(
    "keeps the count of files with its noun on one line, in %s",
    (locale) =>
      Effect.gen(function* () {
        const t = yield* aiTranslator(locale);

        const count = refusalReason("max_files", t);

        // The learner reads "10 files" as one word, so a line never ends between
        // the number and the noun it counts.
        expect(count).toContain(`${NINA_FILE_COUNT}${NO_BREAK}`);
        expect(count).not.toContain(`${NINA_FILE_COUNT} `);
      })
  );
});
