/// <reference path="../../types/fonts.d.ts" />

import { Effect, Schema } from "effect";
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

/** The faces nearly every formula draws with, as CSS font shorthands. */
const CORE_MATH_FONTS = ["1em KaTeX_Main", "italic 1em KaTeX_Math"] as const;

/** Expected browser failure while loading the core math faces early. */
export class MathFontLoadError extends Schema.TaggedError<MathFontLoadError>()(
  "MathFontLoadError",
  {
    cause: Schema.Unknown,
  }
) {}

/**
 * Loads the core math faces before any formula renders, for surfaces such as
 * a chat whose math arrives after the page. The browser's font loading API
 * fetches the faces KaTeX's stylesheet declares without a preload hint that
 * would warn when a conversation holds no math.
 */
export const loadMathFonts = Effect.fn("designSystem.markdown.loadMathFonts")(
  function* (fonts: Pick<FontFaceSet, "load">) {
    yield* Effect.tryPromise({
      try: () => Promise.all(CORE_MATH_FONTS.map((font) => fonts.load(font))),
      catch: (cause) => new MathFontLoadError({ cause }),
    });
  }
);

/** Reads the KaTeX faces one rendered formula draws with, from its classes. */
export function readMathFonts(html: string): readonly MathFont[] {
  const elements = Array.from(
    html.matchAll(CLASS_ATTRIBUTE),
    ([, classes]) => new Set(classes.split(" "))
  );
  const fonts = new Set<MathFont>();
  for (const [font, group] of MATH_FONT_CLASSES) {
    if (elements.some((classes) => group.every((name) => classes.has(name)))) {
      fonts.add(font);
    }
  }
  return [...fonts];
}
