import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Record as Rec, Schema, String as Str } from "effect";

/** The English messages of the Toast namespace, from which every toast key is derived. */
type ToastMessages = typeof en.Toast;

/**
 * A key of a toast title, such as `action-error.title`. Each entry of the
 * namespace has a title, so each entry gives one key.
 */
export type ToastTitleKey = {
  [Name in keyof ToastMessages]: ToastMessages[Name] extends { title: string }
    ? `${Name & string}.title`
    : never;
}[keyof ToastMessages];

/** A key of a toast description, such as `action-error.description`, for each entry that has one. */
export type ToastDescriptionKey = {
  [Name in keyof ToastMessages]: ToastMessages[Name] extends {
    description: string;
  }
    ? `${Name & string}.description`
    : never;
}[keyof ToastMessages];

/**
 * The values a toast message interpolates, by the name of its placeholder. The
 * test in `toast.test.ts` checks that every placeholder of the dictionary is
 * named here.
 */
export const ToastValuesSchema = Schema.Struct({ size: Schema.Finite });
/** The values of one toast message, which the Toaster passes to the locale seam. */
export type ToastValues = typeof ToastValuesSchema.Type;

/**
 * The keys of the toast messages that interpolate a value, such as the size in
 * `failure-attachment-size.description`. A copy that names one of them must pass
 * its values, and the type of the copy checks it. The dictionaries are JSON,
 * whose types hold no placeholders, so `toast.test.ts` checks this list against
 * the placeholders of every locale.
 */
export const ToastValueKeySchema = Schema.Literals([
  "failure-attachment-size.description",
]);
/** A key of a toast message that interpolates a value, so its copy must pass the values. */
export type ToastValueKey = typeof ToastValueKeySchema.Type;

/**
 * How many characters one line of a toast title holds at 320px.
 *
 * Sonner 2.0.8 (`dist/index.mjs`, `dist/styles.css`) sets the toast to the
 * viewport less `--mobile-offset`, which is 16px on each side below 600px. The
 * toast keeps 16px of padding and a 1px border on each side, so 288px less 34px
 * leaves 254px. The icon takes 16px with a -3px start and a 4px end margin,
 * and a 6px gap follows it: 254px less 17px less 6px leaves 231px of text.
 *
 * The toast sets 13px text in Inter (`font-sans`). Inter's metrics as the
 * framework's font metrics file records them (`xWidthAvg` over 2048 units):
 * 988 at weight 500, the title, and 978 at weight 400, the description. A
 * character is 13 × 988 / 2048 ≈ 6.27px in a title and 13 × 978 / 2048 ≈ 6.21px
 * in a description. A title line holds 231 / 6.27 ≈ 36.8 characters, so 36
 * whole characters, and a description line holds 231 / 6.21 ≈ 37.2, so 37.
 *
 * These are averages over the font, not a measured width, so a line of one
 * text may break a little earlier than its count says. The copy test measures
 * each message by whole words on these lines, which keeps that margin in the
 * measure rather than in the copy.
 */
export const TOAST_TITLE_LINE_CHARACTERS = 36;
/** How many characters one line of a toast description holds at 320px. See `TOAST_TITLE_LINE_CHARACTERS`. */
export const TOAST_DESCRIPTION_LINE_CHARACTERS = 37;
/** How many lines a toast title takes at most: one. */
export const TOAST_TITLE_LINES = 1;
/** How many lines a toast description takes at most: two, which the Toaster clamps. */
export const TOAST_DESCRIPTION_LINES = 2;

/** The copy of one toast as the dictionary holds it: a title, and a description when it has one. */
const ToastCopyTextSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});
/** The text of one toast copy, as the dictionary holds it. */
export type ToastCopyText = typeof ToastCopyTextSchema.Type;

/** One part of a toast copy that takes more lines than the Toaster shows. */
const OverlongToastPartSchema = Schema.Struct({
  key: Schema.optional(Schema.String),
  limit: Schema.Finite,
  lines: Schema.Finite,
  part: Schema.Literals(["description", "title"]),
});
type OverlongToastPart = typeof OverlongToastPartSchema.Type;

const graphemes = new Intl.Segmenter();

/**
 * The length of a text in characters, where a character is what a reader sees
 * as one: an accented letter or an emoji counts once. Placeholders such as
 * `{count, number}` count in full, which measures them longer than they show.
 */
export function characterCount(text: string) {
  return Arr.fromIterable(graphemes.segment(text)).length;
}

/**
 * How many lines a text takes when each line holds `width` characters and a
 * word that does not fit moves to the next line. A word longer than a line
 * breaks across lines of its own, and the word after it starts a new line.
 */
export function lineCount(text: string, width: number) {
  // Only a plain space ends a word: a no-break space keeps a number and its unit on one line.
  const words = Arr.filter(Str.split(text, " "), (word) => word !== "");
  const layout = Arr.reduce(words, { filled: 0, lines: 0 }, (state, word) => {
    const length = characterCount(word);
    if (length > width) {
      return { filled: width, lines: state.lines + Math.ceil(length / width) };
    }
    if (state.lines === 0) {
      return { filled: length, lines: 1 };
    }
    if (state.filled + 1 + length <= width) {
      return { filled: state.filled + 1 + length, lines: state.lines };
    }
    return { filled: length, lines: state.lines + 1 };
  });
  return layout.lines;
}

/** The parts of one toast copy that take more lines than the Toaster shows. */
export function overlongToastParts(copy: typeof ToastCopyTextSchema.Type) {
  const title: OverlongToastPart = {
    limit: TOAST_TITLE_LINES,
    lines: lineCount(copy.title, TOAST_TITLE_LINE_CHARACTERS),
    part: "title",
  };
  const description: readonly OverlongToastPart[] =
    copy.description === undefined
      ? []
      : [
          {
            limit: TOAST_DESCRIPTION_LINES,
            lines: lineCount(
              copy.description,
              TOAST_DESCRIPTION_LINE_CHARACTERS
            ),
            part: "description",
          },
        ];
  return Arr.filter([title, ...description], (part) => part.lines > part.limit);
}

/** Every part of a toast namespace that takes too many lines, named by the key of its copy. */
export function overlongToastCopy(
  copies: Readonly<Record<string, typeof ToastCopyTextSchema.Type>>
) {
  return Arr.flatMap(Rec.toEntries(copies), ([key, copy]) =>
    Arr.map(overlongToastParts(copy), (overlong) => ({ ...overlong, key }))
  );
}
