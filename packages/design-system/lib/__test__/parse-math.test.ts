import { preprocessLaTeX } from "@repo/design-system/lib/parse-math";
import { Lexer } from "marked";
import { describe, expect, it } from "vitest";

describe("preprocessLaTeX", () => {
  it("returns empty text unchanged", () => {
    expect(preprocessLaTeX("")).toBe("");
  });

  it("keeps closed code fences unchanged while normalizing prose after them", () => {
    const markdown = [
      "```ts",
      'const value = "\\\\(x\\\\)";',
      "```",
      "Then \\(y\\)",
    ].join("\n");

    expect(preprocessLaTeX(markdown)).toBe(
      ['```ts\nconst value = "\\\\(x\\\\)";\n```', "Then $$y$$"].join("\n")
    );
  });

  it("keeps unclosed code fences unchanged", () => {
    const markdown = ["```ts", "const value = \\(x\\)"].join("\n");

    expect(preprocessLaTeX(markdown)).toBe(markdown);
  });

  it("normalizes display math outside lists", () => {
    expect(preprocessLaTeX(["Intro", "\\[x^2\\]"].join("\n"))).toContain(
      "```math\nx^2\n```"
    );
  });

  it("keeps display math inside blockquotes", () => {
    const markdown = [
      "> **Rumus Hubungannya:**",
      "> \\[w = m \\cdot g\\]",
      "> (\\(w\\) = berat, \\(m\\) = massa, \\(g\\) = percepatan gravitasi)",
    ].join("\n");

    const output = preprocessLaTeX(markdown);
    const tokens = Lexer.lex(output, { gfm: true });

    expect(output).toContain("> ```math\n> w = m \\cdot g\n> ```");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe("blockquote");
  });

  it("ignores indented prose that is not part of a list", () => {
    const markdown = ["Intro", "  continued", "  \\[x\\]"].join("\n");

    expect(preprocessLaTeX(markdown)).toContain("```math\nx\n```");
  });

  it("normalizes numbered list display math with list indentation", () => {
    const markdown = ["1. Step", "   \\[x\\]"].join("\n");

    expect(preprocessLaTeX(markdown)).toContain("   ```math\n   x\n   ```");
  });

  it.each([
    "-",
    "*",
    "+",
  ])("keeps display math inside %s bullet lists aligned with following prose", (marker) => {
    const markdown = [
      `${marker}   **Penyederhanaan:**`,
      "    \\[\\frac{x^2 - 9}{x - 3} = x + 3\\]",
      "    *Ingat:* Domainnya adalah \\(x \\neq 3\\), karena penyebut tidak boleh nol.",
    ].join("\n");

    const output = preprocessLaTeX(markdown);

    expect(output).toContain(
      "    ```math\n    \\frac{x^2 - 9}{x - 3} = x + 3\n    ```"
    );
    expect(output).toContain(
      "    *Ingat:* Domainnya adalah $$x \\neq 3$$, karena penyebut tidak boleh nol."
    );
    expect(output).not.toContain("\n\n```math");
    expect(JSON.stringify(Lexer.lex(output, { gfm: true }))).not.toContain(
      '"codeBlockStyle":"indented"'
    );
  });

  it("normalizes dollar math inside plain code fences into math fences", () => {
    const markdown = ["```", "$x^2$", "```"].join("\n");

    expect(preprocessLaTeX(markdown)).toContain("```math\nx^2\n```");
  });

  it("normalizes malformed fenced math blocks", () => {
    expect(preprocessLaTeX("```math x^2```")).toBe(
      ["", "", "```math", "x^2", "```", "", ""].join("\n")
    );
  });

  it("normalizes hallucinated MDX math components", () => {
    expect(preprocessLaTeX('<InlineMath math="x^2" />')).toBe("$$x^2$$");
    expect(preprocessLaTeX('<BlockMath math="x^2" />')).toBe(
      ["", "", "```math", "x^2", "```", "", ""].join("\n")
    );
  });

  it("normalizes inline math delimiter variants", () => {
    const markdown = "`$a$` `$$b$$` `\\(c\\)` \\(d\\)";

    expect(preprocessLaTeX(markdown)).toBe("$$a$$ $$b$$ $$c$$ $$d$$");
  });

  it("normalizes HTML math tags", () => {
    expect(preprocessLaTeX("<math>x^2</math>")).toBe(
      ["", "", "```math", "x^2", "```", "", ""].join("\n")
    );
  });
});
