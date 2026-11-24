import { Array as Arr, Option, Schema, String as Str } from "effect";

/**
 * Sets the claim in lines on its printed card: the largest type at which the
 * whole claim fits the card's text box, broken between words. A measure
 * gives the width of a text at a font size of 1, as a canvas measures it
 * scaled down, since type grows in proportion to its size.
 */

/** The claim set in lines at one font size. */
const SettingSchema = Schema.Struct({
  lines: Schema.Array(Schema.String),
  size: Schema.Finite,
});
type Setting = typeof SettingSchema.Type;

/** The box the text must fit, and how tall a line is for each unit of font size. */
const BoxSchema = Schema.Struct({
  height: Schema.Finite,
  leading: Schema.Finite,
  width: Schema.Finite,
});

/** The space between two words, of any length. */
const SPACES = /\s+/u;

/** How much smaller each try's type is than the one before. */
const STEP = 0.94;

/**
 * Breaks a text into lines no wider than `width` at a font size of 1,
 * between words. A word wider than a line stands on a line of its own.
 */
export function wrapLines(
  text: string,
  width: number,
  measure: (text: string) => number
): readonly string[] {
  const words = Arr.filter(Str.split(Str.trim(text), SPACES), Str.isNonEmpty);
  return Arr.reduce(words, Arr.empty<string>(), (lines, word) =>
    Option.match(
      Option.filter(
        Arr.last(lines),
        (last) => measure(`${last} ${word}`) <= width
      ),
      {
        onNone: () => Arr.append(lines, word),
        onSome: (last) =>
          Arr.append(Arr.dropRight(lines, 1), `${last} ${word}`),
      }
    )
  );
}

/**
 * The largest font size, from `largest` down to `smallest`, at which the text
 * fits the box in lines no wider than the box; the smallest size when none fits.
 */
export function fitText(
  text: string,
  box: typeof BoxSchema.Type,
  sizes: { readonly largest: number; readonly smallest: number },
  measure: (text: string) => number
): Setting {
  const setAt = (size: number): Setting => ({
    lines: wrapLines(text, box.width / size, measure),
    size,
  });
  const fits = (setting: Setting) =>
    setting.lines.length * setting.size * box.leading <= box.height &&
    Arr.every(
      setting.lines,
      (line) => measure(line) * setting.size <= box.width
    );
  const tries = Math.ceil(
    Math.log(sizes.smallest / sizes.largest) / Math.log(STEP)
  );
  return Option.getOrElse(
    Arr.findFirst(
      Arr.map(
        Arr.makeBy(
          Math.max(1, tries),
          (index) => sizes.largest * STEP ** index
        ),
        setAt
      ),
      fits
    ),
    () => setAt(sizes.smallest)
  );
}
