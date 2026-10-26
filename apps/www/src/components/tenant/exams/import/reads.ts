import { Array as Arr, Option } from "effect";

/** The longest part of a Word file one read carries, so a read stays near five pages of text. */
const WORD_READ_LENGTH = 12_000;

/**
 * The reads of a Word document: its lines in parts of at most `length` characters. A part ends
 * before a line that starts a top-level list item when one is in its second half, so a numbered
 * question stays whole; otherwise it ends where the length runs out. A single line longer than a
 * part is a part of its own.
 */
export const wordReads = (
  lines: readonly string[],
  length = WORD_READ_LENGTH
): string[] => {
  if (!Arr.isReadonlyArrayNonEmpty(lines)) {
    return [];
  }
  const totals = Arr.drop(
    Arr.scan(lines, 0, (sum, line) => sum + line.length + 1),
    1
  );
  const end = Math.max(
    Arr.length(Arr.filter(totals, (total) => total <= length)),
    1
  );
  const starts = Arr.filter(
    Arr.makeBy(end, (index) => index),
    (index) =>
      index >= Math.ceil(end / 2) &&
      Option.exists(Arr.get(lines, index), (line) => line.startsWith("- "))
  );
  const cut =
    end < lines.length ? Option.getOrElse(Arr.last(starts), () => end) : end;
  return [
    Arr.join(Arr.take(lines, cut), "\n"),
    ...wordReads(Arr.drop(lines, cut), length),
  ];
};

/** The mark of picture N in a Word file's text, as the Word reader writes it. */
const PICTURE_MARK = /\[image (\d+)\]/gu;

/** What a picture mark holds before its number. */
const MARK_START = "[image ";

/**
 * The pictures one read of a Word file carries, and its text with their marks counted from one
 * within the read, as Nina receives them: the read's picture K is the file's picture that its
 * K-th distinct mark names. A mark that names no picture of the file is left as it is.
 */
export const readPictures = <Picture>(
  text: string,
  pictures: readonly Picture[]
) => {
  const numbers = Arr.dedupe(
    Arr.filter(
      Arr.map(Arr.fromIterable(text.matchAll(PICTURE_MARK)), ([mark]) =>
        Number.parseInt(mark.slice(MARK_START.length, -1), 10)
      ),
      (number) => number >= 1 && number <= pictures.length
    )
  );
  return {
    pictures: Arr.getSomes(
      Arr.map(numbers, (number) => Arr.get(pictures, number - 1))
    ),
    text: text.replace(PICTURE_MARK, (mark, digits: string) =>
      Option.match(
        Arr.findFirstIndex(
          numbers,
          (number) => number === Number.parseInt(digits, 10)
        ),
        {
          onNone: () => mark,
          onSome: (index) => `[image ${index + 1}]`,
        }
      )
    ),
  };
};
