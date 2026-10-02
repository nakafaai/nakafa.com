import { describe, expect, it } from "@effect/vitest";
import {
  packMathMarkup,
  unpackMathMarkup,
} from "@repo/design-system/lib/markdown/markup";
import { Schema } from "effect";
import katex from "katex";

/** Characters Next escapes when it inlines the RSC payload in a script. */
const ESCAPED = /[<>"&\\]/;
const HTML_ESCAPES = /[<>&]/g;

/** Formulas that exercise KaTeX's markup: SVG, tables, text, and errors. */
const FORMULAS = [
  ["6", false],
  ["x^2 + 1", false],
  ["(x, y) \\rightarrow (-y, x)", true],
  ["\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", true],
  ["\\begin{aligned} u &= x-a \\\\ v &= y-b \\end{aligned}", true],
  ["\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}", true],
  ["\\overrightarrow{AB} + \\widehat{xyz}", false],
  ['\\text{jika } x \\neq 0 \\text{ "dan" } a~b', false],
  ["\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}", true],
  ["\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1", true],
  ["\\mathbb{R} < \\infty \\;\\&\\; 1 > 0", false],
  ["\\frac{", false],
] as const;

function render(math: string, displayMode: boolean) {
  return katex.renderToString(math, { displayMode, throwOnError: false });
}

/** Bytes a string prop costs once Next inlines the payload in the page. */
function inlinePayloadBytes(text: string) {
  const script = JSON.stringify(JSON.stringify(text)).replace(
    HTML_ESCAPES,
    (character) => `\\u00${character.charCodeAt(0).toString(16)}`
  );
  return new TextEncoder().encode(script).length;
}

describe("math markup packing", () => {
  it("restores KaTeX's markup exactly", () => {
    for (const [math, displayMode] of FORMULAS) {
      const markup = render(math, displayMode);
      expect(unpackMathMarkup(packMathMarkup(markup))).toBe(markup);
    }
  });

  it("leaves no character the payload would escape", () => {
    for (const [math, displayMode] of FORMULAS) {
      expect(packMathMarkup(render(math, displayMode))).not.toMatch(ESCAPED);
    }
  });

  it("carries a formula in a fraction of its markup's payload bytes", () => {
    const markup = render("\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", true);

    expect(inlinePayloadBytes(packMathMarkup(markup))).toBeLessThan(
      inlinePayloadBytes(markup) / 4
    );
  });

  it("keeps literal markers apart from the tokens beside them", () => {
    const text = '~<span class="mord">~~</span>~';

    expect(unpackMathMarkup(packMathMarkup(text))).toBe(text);
  });

  it.prop("restores any text", [Schema.String], ([text]) => {
    expect(unpackMathMarkup(packMathMarkup(text))).toBe(text);
  });

  it.prop(
    "never leaves an escaped character in any text",
    [Schema.String],
    ([text]) => {
      expect(packMathMarkup(text)).not.toMatch(ESCAPED);
    }
  );
});
