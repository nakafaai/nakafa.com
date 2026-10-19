import {
  NINA_DOCUMENT_SIZE,
  NINA_FILE_COUNT,
} from "@repo/backend/client/nina/uploads";
import type { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import { Array as Arr, Match } from "effect";
import type { useTranslations } from "use-intl";

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
 * The short reason that a refused file shows in its chip, from the code that
 * refused it. The count in the reason is the limit the code checks.
 */
export function refusalReason(
  code: PromptInputFileConstraintError["code"],
  t: ReturnType<typeof useTranslations<"Ai">>
) {
  return Match.value(code).pipe(
    Match.when("accept", () => t("attachment-rejections.type")),
    Match.when("empty", () => t("attachment-rejections.empty")),
    Match.when("max_file_size", () => t("attachment-rejections.size")),
    Match.when("max_files", () =>
      t("attachment-rejections.count", { count: NINA_FILE_COUNT })
    ),
    Match.exhaustive
  );
}

/**
 * How many characters at the end of a file name always stay in view. Names of
 * versions and the extension differ at the end, so the start gives way first.
 * Twelve keep a version mark and an extension such as " v12.pdf" whole.
 * names.browser.ts pins, at 320 and 1440 px, that a long name shows its start
 * and its whole end together in a chip, and that an end of emoji or Chinese
 * characters stays inside the chip.
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
