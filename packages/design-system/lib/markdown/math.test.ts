// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { preprocessLaTeX } from "@repo/design-system/lib/markdown/math";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr } from "effect";
import { Lexer } from "marked";

describe("preprocessLaTeX", () => {
  it("returns empty text unchanged", () => {
    expect(preprocessLaTeX("")).toBe("");
  });

  it("keeps closed code fences unchanged while normalizing prose after them", () => {
    const markdown = Arr.join(
      ["```ts", 'const value = "\\\\(x\\\\)";', "```", "Then \\(y\\)"],
      "\n"
    );

    expect(preprocessLaTeX(markdown)).toBe(
      Arr.join(['```ts\nconst value = "\\\\(x\\\\)";\n```', "Then $$y$$"], "\n")
    );
  });

  it("keeps unclosed code fences unchanged", () => {
    const markdown = Arr.join(["```ts", "const value = \\(x\\)"], "\n");

    expect(preprocessLaTeX(markdown)).toBe(markdown);
  });

  it("normalizes display math outside lists", () => {
    expect(preprocessLaTeX(Arr.join(["Intro", "\\[x^2\\]"], "\n"))).toContain(
      "```math\nx^2\n```"
    );
  });

  it("keeps display math inside blockquotes", () => {
    const markdown = Arr.join(
      [
        "> **Rumus Hubungannya:**",
        "> \\[w = m \\cdot g\\]",
        "> (\\(w\\) = berat, \\(m\\) = massa, \\(g\\) = percepatan gravitasi)",
      ],
      "\n"
    );

    const output = preprocessLaTeX(markdown);
    const tokens = Lexer.lex(output, { gfm: true });

    expect(output).toContain("> ```math\n> w = m \\cdot g\n> ```");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe("blockquote");
  });

  it("ignores indented prose that is not part of a list", () => {
    const markdown = Arr.join(["Intro", "  continued", "  \\[x\\]"], "\n");

    expect(preprocessLaTeX(markdown)).toContain("```math\nx\n```");
  });

  it("normalizes numbered list display math with list indentation", () => {
    const markdown = Arr.join(["1. Step", "   \\[x\\]"], "\n");

    expect(preprocessLaTeX(markdown)).toContain("   ```math\n   x\n   ```");
  });

  it.each(["-", "*", "+"])(
    "keeps display math inside %s bullet lists aligned with following prose",
    (marker) => {
      const markdown = Arr.join(
        [
          `${marker}   **Penyederhanaan:**`,
          "    \\[\\frac{x^2 - 9}{x - 3} = x + 3\\]",
          "    *Ingat:* Domainnya adalah \\(x \\neq 3\\), karena penyebut tidak boleh nol.",
        ],
        "\n"
      );

      const output = preprocessLaTeX(markdown);

      expect(output).toContain(
        "    ```math\n    \\frac{x^2 - 9}{x - 3} = x + 3\n    ```"
      );
      expect(output).toContain(
        "    *Ingat:* Domainnya adalah $$x \\neq 3$$, karena penyebut tidak boleh nol."
      );
      expect(output).not.toContain("\n\n```math");
      expect(encodeJsonText(Lexer.lex(output, { gfm: true }))).not.toContain(
        '"codeBlockStyle":"indented"'
      );
    }
  );

  it("normalizes dollar math inside plain code fences into math fences", () => {
    const markdown = Arr.join(["```", "$x^2$", "```"], "\n");

    expect(preprocessLaTeX(markdown)).toContain("```math\nx^2\n```");
  });

  it("normalizes malformed fenced math blocks", () => {
    expect(preprocessLaTeX("```math x^2```")).toBe(
      Arr.join(["", "", "```math", "x^2", "```", "", ""], "\n")
    );
  });

  it("normalizes hallucinated MDX math components", () => {
    expect(preprocessLaTeX('<InlineMath math="x^2" />')).toBe("$$x^2$$");
    expect(preprocessLaTeX('<BlockMath math="x^2" />')).toBe(
      Arr.join(["", "", "```math", "x^2", "```", "", ""], "\n")
    );
  });

  it("normalizes inline math delimiter variants", () => {
    const markdown = "`$a$` `$$b$$` `\\(c\\)` \\(d\\)";

    expect(preprocessLaTeX(markdown)).toBe("$$a$$ $$b$$ $$c$$ $$d$$");
  });

  it("normalizes plain single-dollar spans that contain math syntax", () => {
    const markdown = "Sebanyak $15,00\\ \\text{g}$ besi dan $x^2 + 1$ oksigen.";

    expect(preprocessLaTeX(markdown)).toBe(
      "Sebanyak $$15,00\\ \\text{g}$$ besi dan $$x^2 + 1$$ oksigen."
    );
  });

  it("normalizes group notation in single-dollar spans", () => {
    const markdown =
      "For a $p$-group $G$, the center $Z(G)$, order $|G|$, center order $|Z(G)|$, and quotient $G/Z(G)$ are standard notation.";

    expect(preprocessLaTeX(markdown)).toBe(
      "For a $$p$$-group $$G$$, the center $$Z(G)$$, order $$|G|$$, center order $$|Z(G)|$$, and quotient $$G/Z(G)$$ are standard notation."
    );
  });

  it("keeps plain single-dollar currency text unchanged", () => {
    const markdown = "Harga $15,00$ sekarang, bukan $12 dan $13.";

    expect(preprocessLaTeX(markdown)).toBe(markdown);
  });

  it("keeps empty single-dollar spans unchanged", () => {
    const markdown = "Kosong $ $ tetap teks biasa.";

    expect(preprocessLaTeX(markdown)).toBe(markdown);
  });

  it("normalizes HTML math tags", () => {
    expect(preprocessLaTeX("<math>x^2</math>")).toBe(
      Arr.join(["", "", "```math", "x^2", "```", "", ""], "\n")
    );
  });
});
