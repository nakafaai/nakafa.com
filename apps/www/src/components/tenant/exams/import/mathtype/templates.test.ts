import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { templateLatex } from "@/components/tenant/exams/import/mathtype/templates";

/** One template: its selector, its variation and its slots in stream order. */
type Case = readonly [number, number, ...string[]];

/** The LaTeX of each template, or null for one the reader keeps as a picture. */
const latexOfAll = (cases: readonly Case[]) =>
  Arr.map(cases, ([selector, variation, ...slots]) =>
    Option.getOrNull(
      Option.map(
        templateLatex(selector, variation, slots),
        ({ latex }) => latex
      )
    )
  );

describe("templateLatex", () => {
  it("writes fences that stretch to their contents, white brackets and intervals", () => {
    expect(
      latexOfAll([
        ...Arr.map(Arr.range(0, 7), (selector): Case => [selector, 3, "a"]),
        [1, 1, "a"],
        [1, 2, "a"],
        [8, 3, "a"],
        [8, 1, "a"],
        [8, 2, "a"],
        [8, 0, "a"],
        [9, 0x12, "a"],
        [9, 0x30, "a"],
      ])
    ).toEqual([
      "\\left\\langle a \\right\\rangle",
      "\\left( a \\right)",
      "\\left\\{ a \\right\\}",
      "\\left[ a \\right]",
      "\\left| a \\right|",
      "\\left\\| a \\right\\|",
      "\\left\\lfloor a \\right\\rfloor",
      "\\left\\lceil a \\right\\rceil",
      "\\left( a \\right.",
      "\\left. a \\right)",
      "\\llbracket a \\rrbracket",
      "\\llbracket a",
      "a \\rrbracket",
      "a",
      "\\left[ a \\right)",
      "\\left( a \\right]",
    ]);
  });

  it("writes roots, fractions, bars, braces, accents, strikes and boxes", () => {
    expect(
      latexOfAll([
        [10, 0, "a"],
        [10, 1, "a", "3"],
        [11, 0, "a", "b"],
        [11, 1, "a", "b"],
        [11, 2, "a", "b"],
        [11, 0, "a"],
        [12, 0, "a"],
        [12, 1, "a"],
        [13, 0, "a"],
        [13, 1, "a"],
        [24, 1, "a", "b"],
        [25, 0, "a", "b"],
        [32, 0, "a"],
        [33, 0, "a"],
        [34, 0, "a"],
        [36, 2, "a"],
        [36, 4, "a"],
        [36, 6, "a"],
        [37, 0x1e, "a"],
      ])
    ).toEqual([
      "\\sqrt{a}",
      "\\sqrt[3]{a}",
      "\\frac{a}{b}",
      "\\tfrac{a}{b}",
      "{a}/{b}",
      "\\frac{a}{}",
      "\\underline{a}",
      "\\underline{\\underline{a}}",
      "\\overline{a}",
      "\\overline{\\overline{a}}",
      "\\overbrace{a}^{b}",
      "\\underbrace{a}_{b}",
      "\\widetilde{a}",
      "\\widehat{a}",
      "\\overset{\\frown}{a}",
      "\\cancel{a}",
      "\\bcancel{a}",
      "\\xcancel{a}",
      "\\boxed{a}",
    ]);
  });

  it("writes extensible arrows with their labels over and under them", () => {
    expect(
      latexOfAll([
        [14, 0x24, "b", ""],
        [14, 0x18, "", "b"],
        [14, 0x3c, "b", "c"],
        [14, 0x04, "b", ""],
        [14, 0x05, "b", ""],
        [14, 0x06, "b", ""],
      ])
    ).toEqual([
      "\\xrightarrow{b}",
      "\\xleftarrow[b]{}",
      "\\xleftrightarrow[c]{b}",
      "\\xrightarrow{b}",
      "\\xrightleftarrows{b}",
      "\\xrightleftharpoons{b}",
    ]);
  });

  it("writes integrals, big operators and limits with their limits beside them or above and below", () => {
    expect(
      latexOfAll([
        [15, 0x01, "a"],
        [15, 0x31, "b", "c", "a"],
        [15, 0x71, "b", "c", "a"],
        [15, 0x02, ""],
        [15, 0x03, "a"],
        [15, 0x05, "a"],
        [15, 0x06, "a"],
        [15, 0x1_01, "a"],
        [16, 0x70, "a", "i", "n"],
        [17, 0, "a"],
        [18, 0x40, "a"],
        [19, 0x50, "a", "b"],
        [20, 0x10, "a", "b"],
        [21, 0, "a", "", "", "\\cup"],
        [22, 0x70, "", "i", "n", "\\sum"],
        [22, 0x40, "a", "", "", "X"],
        [23, 0x10, "\\lim", "x\\to0"],
        [23, 0x30, "\\max", "a", "b"],
      ])
    ).toEqual([
      "\\int\\nolimits a",
      "\\int\\nolimits_{c}^{a} b",
      "\\int\\limits_{c}^{a} b",
      "\\iint\\nolimits",
      "\\iiint\\nolimits a",
      "\\oint\\nolimits a",
      "\\oiint\\nolimits a",
      "\\int\\nolimits a",
      "\\sum\\limits_{i}^{n} a",
      "\\prod\\nolimits a",
      "\\coprod\\limits a",
      "\\bigcup\\limits_{b} a",
      "\\bigcap\\nolimits_{b} a",
      "\\bigcup\\nolimits a",
      "\\sum\\limits_{i}^{n}",
      "\\mathop{X}\\limits a",
      "\\mathop{\\lim}\\limits_{x\\to0}",
      "\\mathop{\\max}\\limits_{a}^{b}",
    ]);
  });

  it("writes scripts that follow their base, scripts before the item after them, and primes typed as apostrophes", () => {
    expect(
      Arr.map(
        [
          [27, 0, "i", ""],
          [28, 0, "", "2"],
          [29, 0, "i", "2"],
          [29, 1, "a", "b"],
          [28, 0, "", "''"],
          [28, 0, "", "'a"],
        ] satisfies Case[],
        ([selector, variation, ...slots]) =>
          Option.getOrNull(templateLatex(selector, variation, slots))
      )
    ).toEqual([
      { latex: "_{i}", script: true },
      { latex: "^{2}", script: true },
      { latex: "_{i}^{2}", script: true },
      { latex: "{}_{a}^{b}", script: false },
      { latex: "^{\\prime\\prime}", script: true },
      { latex: "^{'a}", script: true },
    ]);
  });

  it("writes bra-kets and vector arrows", () => {
    expect(
      latexOfAll([
        [30, 3, "a", "b"],
        [30, 1, "a", ""],
        [30, 2, "", "b"],
        [31, 2, "v"],
        [31, 2, "\\alpha"],
        [31, 2, "AB"],
        [31, 1, "AB"],
        [31, 3, "AB"],
        [31, 5, "AB"],
        [31, 6, "AB"],
        [31, 7, "AB"],
        [31, 9, "AB"],
        [31, 0xa, "AB"],
      ])
    ).toEqual([
      "\\langle a \\vert b \\rangle",
      "\\langle a \\vert",
      "\\vert b \\rangle",
      "\\vec{v}",
      "\\vec{\\alpha}",
      "\\overrightarrow{AB}",
      "\\overleftarrow{AB}",
      "\\overleftrightarrow{AB}",
      "\\underleftarrow{AB}",
      "\\underrightarrow{AB}",
      "\\underleftrightarrow{AB}",
      "\\overleftharpoon{AB}",
      "\\overrightharpoon{AB}",
    ]);
  });

  it("writes nothing for a template LaTeX has no faithful form of", () => {
    expect(
      latexOfAll([
        [14, 0x07, "b", ""],
        [15, 0x09, "a"],
        [15, 0x00, "a"],
        [26, 0, "a"],
        [31, 0, "a"],
        [31, 0xb, "a"],
        [31, 0xe, "a"],
        [35, 0, "a"],
        [36, 1, "a"],
        [99, 0, "a"],
      ])
    ).toEqual(Arr.makeBy(10, () => null));
  });
});
