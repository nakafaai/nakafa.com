import { Array as Arr, Record as Rec, Schema } from "effect";

/**
 * How many characters a toast title holds on one line at 320px.
 *
 * Sonner 2.0.8 (`dist/index.mjs`, `dist/styles.css`) sets the toast to the
 * viewport less `--mobile-offset`, which is 16px on each side below 600px. The
 * toast keeps 16px of padding and a 1px border on each side, so 288px less 34px
 * leaves 254px. The icon takes 16px with a -3px start and a 4px end margin,
 * and a 6px gap follows it: 254px less 17px less 6px leaves 231px of text.
 *
 * The toast sets 13px text in Inter (`font-sans`). Next ships Inter's metrics
 * (`next/dist/server/capsize-font-metrics.json`, `xWidthAvg` over 2048 units):
 * 988 at weight 500, the title, and 978 at weight 400, the description. A
 * character is 13 × 988 / 2048 ≈ 6.27px in a title and 13 × 978 / 2048 ≈ 6.21px
 * in a description, so one line holds 231 / 6.27 ≈ 36.8 characters of a title.
 */
export const TOAST_TITLE_CHARACTERS = 36;

/**
 * How many characters a toast description holds in two lines at 320px: 231px
 * over 6.21px is 37.2 characters a line, so two lines hold 74. Word wrapping
 * moves a word that does not fit to the next line and can leave up to 12
 * characters empty, so the description keeps 12 characters back: 74 less 12.
 */
export const TOAST_DESCRIPTION_CHARACTERS = 62;

/** The copy of one toast as the dictionary holds it: a title, and a description when it has one. */
const ToastCopyTextSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

/** One part of a toast copy that is longer than its line allows. */
const OverlongToastPartSchema = Schema.Struct({
  budget: Schema.Finite,
  characters: Schema.Finite,
  key: Schema.optional(Schema.String),
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

/** The parts of one toast copy that its title or description line cannot hold. */
export function overlongToastParts(copy: typeof ToastCopyTextSchema.Type) {
  const title: OverlongToastPart = {
    budget: TOAST_TITLE_CHARACTERS,
    characters: characterCount(copy.title),
    part: "title",
  };
  const description: readonly OverlongToastPart[] =
    copy.description === undefined
      ? []
      : [
          {
            budget: TOAST_DESCRIPTION_CHARACTERS,
            characters: characterCount(copy.description),
            part: "description",
          },
        ];
  return Arr.filter(
    [title, ...description],
    (part) => part.characters > part.budget
  );
}

/** Every part of a toast namespace that a line cannot hold, named by the key of its copy. */
export function overlongToastCopy(
  copies: Readonly<Record<string, typeof ToastCopyTextSchema.Type>>
) {
  return Arr.flatMap(Rec.toEntries(copies), ([key, copy]) =>
    Arr.map(overlongToastParts(copy), (overlong) => ({ ...overlong, key }))
  );
}
