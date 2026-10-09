import { createRequire } from "node:module";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  loadMathFonts,
  MATH_FONT_FILES,
  type MathFont,
  MathFontLoadError,
  readMathFonts,
} from "@repo/design-system/lib/markdown/fonts";
import { Array as Arr, Effect, FileSystem, Option } from "effect";
import katex from "katex";

const FONT_FAMILY = /font-family:\s*KaTeX_([A-Za-z0-9]+)/;
const BOLD = /font-weight:\s*bold/;
const ITALIC = /font-style:\s*italic/;
const COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
const CHILD_SPAN = /\s*>\s*span\s*$/;
const WHITESPACE = /\s+/;

/** Renders one formula the way the math components do. */
function render(math: string, displayMode = false) {
  return katex.renderToString(math, { displayMode, throwOnError: false });
}

function isMathFont(face: string): face is MathFont {
  return Object.hasOwn(MATH_FONT_FILES, face);
}

/** The face a KaTeX font rule selects, when it is one loaded early. */
function ruleFont(declarations: string) {
  const family = FONT_FAMILY.exec(declarations)?.[1];
  if (!family) {
    return;
  }
  const bold = BOLD.test(declarations) ? "Bold" : "";
  const italic = ITALIC.test(declarations) ? "Italic" : "";
  const face = `${family}-${bold + italic || "Regular"}`;
  return isMathFont(face) ? face : undefined;
}

describe("math fonts", () => {
  it("reads the faces a formula draws with", () => {
    expect(readMathFonts(render("6"))).toEqual(["Main-Regular"]);
    expect(readMathFonts(render("x^2 + 1"))).toEqual([
      "Main-Regular",
      "Math-Italic",
    ]);
    expect(readMathFonts(render("\\mathbb{R}"))).toContain("AMS-Regular");
    expect(readMathFonts(render("\\mathbf{v} + \\mathit{w}"))).toEqual(
      expect.arrayContaining(["Main-Bold", "Main-Italic"])
    );
    expect(readMathFonts(render("\\textbf{a}\\textit{b}"))).toEqual(
      expect.arrayContaining(["Main-Bold", "Main-Italic"])
    );
  });

  it("reads the delimiter and operator faces from their classes together", () => {
    expect(readMathFonts(render("\\sum_{i=1}^n i"))).toContain("Size1-Regular");
    expect(readMathFonts(render("\\sum_{i=1}^n i", true))).toContain(
      "Size2-Regular"
    );
    expect(
      readMathFonts(render("\\left( \\frac{a}{b} \\right)", true))
    ).toContain("Size2-Regular");
    expect(
      readMathFonts(
        render("\\left( \\frac{\\frac{a}{b}}{\\frac{c}{d}} \\right)", true)
      )
    ).toContain("Size3-Regular");
    // A superscript carries `size3` only to scale its text.
    expect(readMathFonts(render("x^2"))).not.toContain("Size3-Regular");
  });

  it("reads no faces from a formula KaTeX could not parse", () => {
    expect(readMathFonts(render("\\frac{"))).toEqual([]);
  });

  it.effect(
    "covers every rule in KaTeX's stylesheet that selects a face loaded early",
    () =>
      Effect.gen(function* () {
        const require = createRequire(import.meta.url);
        const fileSystem = yield* FileSystem.FileSystem;
        const css = yield* fileSystem.readFileString(
          require.resolve("katex/dist/katex.css"),
          "utf8"
        );
        const rules = css.replaceAll(COMMENT, "").matchAll(RULE);
        let checked = 0;
        for (const [, selectors, declarations] of rules) {
          const font = ruleFont(declarations);
          if (!font || selectors.includes("@font-face")) {
            continue;
          }
          for (const selector of selectors.split(",")) {
            // The element that draws: the last compound, or its parent when the
            // rule styles a child such as `.delim-size1 > span`.
            const compounds = selector
              .replace(CHILD_SPAN, "")
              .trim()
              .split(WHITESPACE);
            const lastCompound = Arr.last(compounds);
            const classes = Arr.filter(
              Option.isSome(lastCompound) ? lastCompound.value.split(".") : [],
              Boolean
            );
            const html = `<span class="katex"><span class="${Arr.join(classes, " ")}"></span></span>`;
            expect(readMathFonts(html), selector).toContain(font);
            checked += 1;
          }
        }
        expect(checked).toBeGreaterThan(10);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("loads the core faces through the browser's font set", () =>
    Effect.gen(function* () {
      const load = vi.fn().mockResolvedValue([]);

      yield* loadMathFonts({ load });

      expect(load.mock.calls).toEqual([
        ["1em KaTeX_Main"],
        ["italic 1em KaTeX_Math"],
      ]);
    })
  );

  it.effect("maps a failed font load into the typed error channel", () =>
    Effect.gen(function* () {
      const cause = new Error("Font request failed.");
      const load = vi.fn().mockRejectedValue(cause);

      const error = yield* loadMathFonts({ load }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(MathFontLoadError);
      expect(error).toMatchObject({ _tag: "MathFontLoadError", cause });
    })
  );
});
