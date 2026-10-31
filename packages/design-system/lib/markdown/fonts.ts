/// <reference path="../../types/fonts.d.ts" />

import {
  Array as Arr,
  Effect,
  MutableHashSet,
  Predicate,
  Schema,
} from "effect";
import ams from "katex/dist/fonts/KaTeX_AMS-Regular.woff2";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2";
import mainItalic from "katex/dist/fonts/KaTeX_Main-Italic.woff2";
import mainRegular from "katex/dist/fonts/KaTeX_Main-Regular.woff2";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2";
import size1 from "katex/dist/fonts/KaTeX_Size1-Regular.woff2";
import size2 from "katex/dist/fonts/KaTeX_Size2-Regular.woff2";
import size3 from "katex/dist/fonts/KaTeX_Size3-Regular.woff2";
import size4 from "katex/dist/fonts/KaTeX_Size4-Regular.woff2";

/**
 * The KaTeX faces worth loading before math first renders, by the file each
 * one is served from. They are the same files KaTeX's stylesheet declares, so
 * an early load is the one the stylesheet uses. Rarer faces such as Fraktur or
 * Script still load when a formula first draws with them.
 */
export const MATH_FONT_FILES = {
  "AMS-Regular": ams,
  "Main-Bold": mainBold,
  "Main-Italic": mainItalic,
  "Main-Regular": mainRegular,
  "Math-Italic": mathItalic,
  "Size1-Regular": size1,
  "Size2-Regular": size2,
  "Size3-Regular": size3,
  "Size4-Regular": size4,
} as const;

/** One KaTeX face this module can load early. */
export type MathFont = keyof typeof MATH_FONT_FILES;

/**
 * The class names that make KaTeX's stylesheet draw with each face, mirroring
 * the font rules in `katex/dist/katex.css`. A group lists the classes one
 * element must carry together, such as `delimsizing size3`; `size3` alone only
 * scales text.
 */
const MATH_FONT_CLASSES: readonly (readonly [MathFont, readonly string[]])[] = [
  ["Main-Regular", ["katex"]],
  ["Math-Italic", ["mathnormal"]],
  ["Main-Italic", ["mathit"]],
  ["Main-Italic", ["textit"]],
  ["Main-Bold", ["mathbf"]],
  ["Main-Bold", ["textbf"]],
  ["AMS-Regular", ["amsrm"]],
  ["AMS-Regular", ["mathbb"]],
  ["AMS-Regular", ["textbb"]],
  ["Size1-Regular", ["delimsizing", "size1"]],
  ["Size1-Regular", ["delim-size1"]],
  ["Size1-Regular", ["op-symbol", "small-op"]],
  ["Size2-Regular", ["delimsizing", "size2"]],
  ["Size2-Regular", ["op-symbol", "large-op"]],
  ["Size3-Regular", ["delimsizing", "size3"]],
  ["Size4-Regular", ["delimsizing", "size4"]],
  ["Size4-Regular", ["delim-size4"]],
];

const CLASS_ATTRIBUTE = /class="([^"]*)"/g;

/**
 * Each face as the CSS font shorthand that selects it through the `@font-face`
 * rules of KaTeX's stylesheet, which the global stylesheet carries on every page.
 */
const MATH_FONT_SHORTHANDS = {
  "AMS-Regular": "1em KaTeX_AMS",
  "Main-Bold": "bold 1em KaTeX_Main",
  "Main-Italic": "italic 1em KaTeX_Main",
  "Main-Regular": "1em KaTeX_Main",
  "Math-Italic": "italic 1em KaTeX_Math",
  "Size1-Regular": "1em KaTeX_Size1",
  "Size2-Regular": "1em KaTeX_Size2",
  "Size3-Regular": "1em KaTeX_Size3",
  "Size4-Regular": "1em KaTeX_Size4",
} satisfies Record<MathFont, string>;

/** The faces nearly every formula draws with. */
const CORE_MATH_FONTS: readonly MathFont[] = ["Main-Regular", "Math-Italic"];

/** Expected browser failure while loading math faces early. */
export class MathFontLoadError extends Schema.TaggedError<MathFontLoadError>()(
  "MathFontLoadError",
  {
    cause: Schema.Unknown,
  }
) {}

/**
 * Loads math faces before the formulas that draw with them render: the core
 * faces for surfaces such as a chat whose math arrives after the page, or the
 * faces a page's formulas declare before a navigation shows it. The browser's
 * font loading API fetches the faces KaTeX's stylesheet declares without a
 * preload hint that would warn when no formula draws with them.
 */
export const loadMathFonts = Effect.fn("designSystem.markdown.loadMathFonts")(
  function* (
    fonts: Pick<FontFaceSet, "load">,
    faces: readonly MathFont[] = CORE_MATH_FONTS
  ) {
    yield* Effect.tryPromise({
      try: () =>
        Promise.all(
          Arr.map(faces, (face) => fonts.load(MATH_FONT_SHORTHANDS[face]))
        ),
      catch: (cause) => new MathFontLoadError({ cause }),
    });
  }
);

/** Whether a value names a face this module can load early. */
export function isMathFont(value: unknown): value is MathFont {
  return (
    Predicate.isString(value) && Predicate.hasProperty(MATH_FONT_FILES, value)
  );
}

/** Reads the KaTeX faces one rendered formula draws with, from its classes. */
export function readMathFonts(html: string): readonly MathFont[] {
  const elements = Array.from(html.matchAll(CLASS_ATTRIBUTE), ([, classes]) =>
    MutableHashSet.fromIterable(classes.split(" "))
  );
  const matched = Arr.filter(MATH_FONT_CLASSES, ([, group]) =>
    Arr.some(elements, (classes) =>
      Arr.every(group, (name) => MutableHashSet.has(classes, name))
    )
  );
  return Arr.dedupe(Arr.map(matched, ([font]) => font));
}
