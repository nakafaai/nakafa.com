import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  lineLatex,
  mathPiece,
  matrixLatex,
  namePiece,
  pileLatex,
  scriptPiece,
  textPiece,
} from "@/components/tenant/exams/import/mathtype/pieces";

/** The math pieces of a text, one per character. */
const maths = (text: string) => Arr.map(Arr.fromIterable(text), mathPiece);

/** The letters of one function name, the first opening it. */
const name = (text: string) =>
  Arr.map(Arr.fromIterable(text), (letter, index) =>
    namePiece(letter, index === 0)
  );

describe("lineLatex", () => {
  it("joins math pieces with a space only after a command name, runs text into \\text, and letters into one name", () => {
    expect(
      Arr.map(
        [
          maths("x+y"),
          [mathPiece("\\alpha"), mathPiece("x")],
          [mathPiece("\\le"), mathPiece("1")],
          Arr.map(Arr.fromIterable("if a"), textPiece),
          [...name("sin"), ...name("cos")],
          name("argmin"),
          [mathPiece("x"), mathPiece(""), mathPiece("y")],
        ],
        lineLatex
      )
    ).toEqual([
      "x+y",
      "\\alpha x",
      "\\le1",
      "\\text{if a}",
      "\\sin\\cos",
      "\\operatorname{argmin}",
      "xy",
    ]);
  });

  it("sets a script after its base, and gives a script that opens a line an empty base", () => {
    expect(
      Arr.map(
        [
          [mathPiece("x"), scriptPiece("_{i}")],
          [scriptPiece("^{2}"), mathPiece("x")],
        ],
        lineLatex
      )
    ).toEqual(["x_{i}", "{}^{2}x"]);
  });
});

describe("pileLatex", () => {
  it("writes a pile as an array in its alignment, or aligned at the first relation of each line", () => {
    const two = [maths("a"), maths("b")];
    expect(
      Arr.map([1, 2, 3, 5, 0], (alignment) => pileLatex(alignment, two))
    ).toEqual([
      "\\begin{array}{l} a \\\\ b \\end{array}",
      "\\begin{array}{c} a \\\\ b \\end{array}",
      "\\begin{array}{r} a \\\\ b \\end{array}",
      "\\begin{array}{r} a \\\\ b \\end{array}",
      "\\begin{array}{l} a \\\\ b \\end{array}",
    ]);
    expect(
      pileLatex(4, [
        [...maths("x"), mathPiece("="), ...maths("1")],
        [...maths("y+z"), mathPiece("="), ...maths("2")],
        maths("a"),
      ])
    ).toBe("\\begin{aligned} x&=1 \\\\ y+z&=2 \\\\ a \\end{aligned}");
    expect(pileLatex(1, [maths("a")])).toBe("a");
  });
});

describe("matrixLatex", () => {
  it("writes the cells of a matrix row by row", () => {
    expect(matrixLatex(2, ["a", "b", "c", "d"])).toBe(
      "\\begin{matrix} a & b \\\\ c & d \\end{matrix}"
    );
  });
});
