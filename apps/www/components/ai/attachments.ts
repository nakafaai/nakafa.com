import { NINA_DOCUMENT_SIZE } from "@repo/backend/client/nina/uploads";
import { Array as Arr } from "effect";

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
 * How many characters at the end of a file name always stay in view. Names of
 * versions and the extension differ at the end, so the start gives way first.
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
