import { describe, expect, it } from "@effect/vitest";
import { findFormulas } from "@repo/editor/formula";
import { Array as Arr } from "effect";

describe("findFormulas", () => {
  it("finds an inline formula between dollars, and between \\( and \\)", () => {
    expect(findFormulas("Hitung $x^2$ dan \\(y\\) saja")).toEqual([
      { index: 7, kind: "inline", latex: "x^2", text: "$x^2$" },
      { index: 17, kind: "inline", latex: "y", text: "\\(y\\)" },
    ]);
  });

  it("finds a block formula between double dollars, and between \\[ and \\]", () => {
    expect(findFormulas("$$a+b$$ lalu \\[c\\]")).toEqual([
      { index: 0, kind: "block", latex: "a+b", text: "$$a+b$$" },
      { index: 13, kind: "block", latex: "c", text: "\\[c\\]" },
    ]);
  });

  it("reads the LaTeX without the spaces around it, and reads no formula that is blank", () => {
    expect(findFormulas("$  x  $ dan $ $ dan \\(  \\)")).toEqual([
      { index: 0, kind: "inline", latex: "x", text: "$  x  $" },
    ]);
  });

  it("keeps a dollar inside a block out of the inline formulas", () => {
    expect(findFormulas("$$x$$")).toEqual([
      { index: 0, kind: "block", latex: "x", text: "$$x$$" },
    ]);
  });

  it("does not read an inline formula across a line break", () => {
    expect(findFormulas("$x\ny$")).toEqual([]);
    expect(findFormulas("\\(x\ny\\)")).toEqual([]);
  });

  it("lists the formulas in the order they start, whatever their kind", () => {
    expect(
      Arr.map(
        findFormulas("$b$ dan $$c$$ lalu $a$"),
        (formula) => formula.latex
      )
    ).toEqual(["b", "c", "a"]);
  });

  it("finds nothing in a text without a formula", () => {
    expect(findFormulas("Tidak ada rumus di sini.")).toEqual([]);
  });
});
