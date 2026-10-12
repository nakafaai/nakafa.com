import {
  NINA_DOCUMENT_SIZE,
  NINA_FILE_COUNT,
  NINA_FILE_MEBIBYTES,
} from "@repo/backend/client/nina/uploads";
import type { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import { Array as Arr, Match } from "effect";
import type { useTranslations } from "next-intl";

/** How many file names a notice lists for one reason before it counts the rest. */
const NAMES_SHOWN = 3;

/** Documents are the attachments that are not images. Images reach the model by URL and are not counted. */
function isDocument(file: Pick<File, "type">) {
  return !file.type.startsWith("image/");
}

/**
 * Whether the documents of one message exceed the bytes one request can carry.
 * Images of any size are not counted.
 */
export function exceedsDocumentLimit(
  files: readonly Pick<File, "size" | "type">[]
) {
  const bytes = Arr.reduce(
    Arr.filter(files, isDocument),
    0,
    (total, file) => total + file.size
  );
  return bytes > NINA_DOCUMENT_SIZE;
}

/**
 * The words that say why one pick was not attached in full: a title, and for
 * each reason the first names it dropped, how many more there are, and the
 * reason in a few words. The title names no count, because the names below it
 * show which files and how many. The numbers in the reasons are the limits the
 * code checks.
 */
export function rejectionNotice(
  rejections: readonly PromptInputFileConstraintError[],
  t: ReturnType<typeof useTranslations<"Ai">>
) {
  return {
    reasons: Arr.map(rejections, (rejection) => {
      // Two files of one name are one line of the notice.
      const files = Arr.dedupe(rejection.files);
      const names = Arr.take(files, NAMES_SHOWN);
      const more = files.length - names.length;
      return {
        more:
          more > 0 ? t("attachment-rejections.more", { count: more }) : null,
        names,
        reason: Match.value(rejection.code).pipe(
          Match.when("accept", () => t("attachment-rejections.type")),
          Match.when("empty", () => t("attachment-rejections.empty")),
          Match.when("max_file_size", () =>
            t("attachment-rejections.size", { size: NINA_FILE_MEBIBYTES })
          ),
          Match.when("max_files", () =>
            t("attachment-rejections.count", { count: NINA_FILE_COUNT })
          ),
          Match.exhaustive
        ),
      };
    }),
    title: t("attachment-rejections.title"),
  };
}

/**
 * How many characters at the end of a file name always stay in view. Names of
 * versions and the extension differ at the end, so the start gives way first.
 * Measured in the chip of the composer, whose title is the narrowest at 158 px
 * (names.browser.ts reads the same boxes): the last twelve letters of a long
 * name take 76 to 90 px of it, so the start keeps 68 to 82 px; twelve Chinese
 * characters take 141 px; eight emoji and ".pdf" are wider than the title, and
 * the end shortens with an ellipsis there.
 */
export const NAME_TAIL = 12;
const graphemes = new Intl.Segmenter();

/**
 * Splits a file name into the start that may give way and the last
 * `NAME_TAIL` characters that do not. The cut falls between characters a
 * reader sees as one, so an emoji or an accented letter is never torn.
 */
export function splitFileName(name: string) {
  const characters = Arr.map(
    Arr.fromIterable(graphemes.segment(name)),
    ({ segment }) => segment
  );
  return {
    head: Arr.join(Arr.dropRight(characters, NAME_TAIL), ""),
    tail: Arr.join(Arr.takeRight(characters, NAME_TAIL), ""),
  };
}
