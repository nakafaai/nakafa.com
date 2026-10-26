import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  embellish,
  functionName,
  isRelation,
  mathSymbol,
  textSymbol,
} from "@/components/tenant/exams/import/mathtype/symbols";

describe("mathSymbol", () => {
  it("writes ASCII as itself unless LaTeX reserves it, Unicode by its command, and MathType's private codes", () => {
    expect(
      Arr.map(
        [
          0x78, 0x7b, 0x5f, 0x5e, 0x7e, 0x20, 0x3_b1, 0x22_64, 0x21_92, 0x20_32,
          0xa0, 0xef_04, 0xea_34, 0xf0_00, 0xf0_1a, 0xf0_80, 0xf0_c3, 0xf1_00,
          0xe9, 0x01_9b,
        ],
        (code) => Option.getOrNull(mathSymbol(code))
      )
    ).toEqual([
      "x",
      "\\{",
      "\\_",
      "\\hat{}",
      "\\sim",
      "\\ ",
      "\\alpha",
      "\\le",
      "\\to",
      "\\prime",
      "~",
      "\\;",
      "\\lneq",
      "\\mathfrak{A}",
      "\\mathfrak{a}",
      "\\mathbb{A}",
      "\\mathbb{3}",
      "\\mathcal{A}",
      "é",
      "ƛ",
    ]);
  });

  it("writes nothing for a private or control code it does not know, since a guessed glyph changes the mathematics", () => {
    expect(
      Arr.map([0xe0_00, 0xf8_ff, 0x01, 0x7f], (code) =>
        Option.isNone(mathSymbol(code))
      )
    ).toEqual([true, true, true, true]);
  });
});

describe("textSymbol", () => {
  it("writes text with LaTeX's text-mode escapes, a no-break space as a space, and nothing for a private or control code", () => {
    expect(
      Arr.map(
        [0x61, 0x25, 0x5c, 0x7e, 0x5e, 0xa0, 0xe9, 0xe0_00, 0x1f],
        (code) => Option.getOrNull(textSymbol(code))
      )
    ).toEqual([
      "a",
      "\\%",
      "\\textbackslash{}",
      "\\textasciitilde{}",
      "\\textasciicircum{}",
      " ",
      "é",
      null,
      null,
    ]);
  });
});

describe("isRelation and functionName", () => {
  it("knows the relations a pile aligns at, and writes a function name by its command or as an operator name", () => {
    expect([isRelation("="), isRelation("\\le"), isRelation("+")]).toEqual([
      true,
      true,
      false,
    ]);
    expect([functionName("sin"), functionName("argmin")]).toEqual([
      "\\sin",
      "\\operatorname{argmin}",
    ]);
  });
});

describe("embellish", () => {
  it("writes each mark MathType sets on a character, in the order it lists them", () => {
    const marks = [
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22,
      23, 24, 29, 30, 33, 34, 35,
    ];
    expect(
      Arr.map([...Arr.map(marks, (mark) => [mark]), [9, 5], []], (list) =>
        Option.getOrNull(embellish("x", list))
      )
    ).toEqual([
      "\\dot{x}",
      "\\ddot{x}",
      "\\dddot{x}",
      "x'",
      "x''",
      "x^{\\backprime}",
      "\\tilde{x}",
      "\\hat{x}",
      "\\not x",
      "\\vec{x}",
      "\\overleftarrow{x}",
      "\\overleftrightarrow{x}",
      "\\overrightharpoon{x}",
      "\\overleftharpoon{x}",
      "\\bar{x}",
      "x'''",
      "\\overset{\\frown}{x}",
      "\\overset{\\smile}{x}",
      "\\xcancel{x}",
      "\\cancel{x}",
      "\\bcancel{x}",
      "\\ddddot{x}",
      "\\underline{x}",
      "\\utilde{x}",
      "\\underrightarrow{x}",
      "\\underleftarrow{x}",
      "\\underleftrightarrow{x}",
      "\\hat{x}'",
      "x",
    ]);
  });

  it("writes nothing for a character that carries a mark LaTeX has no form for", () => {
    expect(
      Arr.map([[16], [9, 25], [37]], (list) =>
        Option.isNone(embellish("x", list))
      )
    ).toEqual([true, true, true]);
  });
});
