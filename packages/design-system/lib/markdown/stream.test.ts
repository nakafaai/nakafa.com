import { describe, expect, it } from "@effect/vitest";
import { trimIncompleteTail } from "@repo/design-system/lib/markdown/stream";

describe("streamed markdown tail", () => {
  it("returns complete markdown unchanged", () => {
    for (const markdown of [
      "",
      "Plain text with a price of \\$5.",
      "Inline $$x^2$$ and bracket \\(y\\) and \\[z\\] math.",
      "$$\nx + 1\n$$\n\nAfter the display.",
      "```math\nf'(x) = 2x\n```\n\nDone.",
      "~~~~mermaid\ngraph TD\n~~~~~  \nDone.",
      "Ends with a formula $$x$$",
      "Math source has no escapes, so $$a \\$$ closes here.",
      "Literal `$$` and `**` inside code and ``a ` b`` spans.",
      "**Answer:** the slope is **2x**.",
      "An unclosed ** bold\nstays literal once its line ends.",
      "Read [the lesson](https://nakafa.com/x) and [notes] first.",
      "Use `const` and ``a ` b`` here.",
      "Stray [ and ` and ** earlier\nstay literal once their line ends.",
    ]) {
      expect(trimIncompleteTail(markdown)).toBe(markdown);
    }
  });

  it("withholds a formula until its closing delimiter arrives", () => {
    expect(trimIncompleteTail("Cancel $$\\frac{2xh")).toBe("Cancel ");
    expect(trimIncompleteTail("Cancel $$h \\neq 0$")).toBe("Cancel ");
    expect(trimIncompleteTail("Bracket \\[x + ")).toBe("Bracket ");
    expect(trimIncompleteTail("Paren \\(x")).toBe("Paren ");
    expect(trimIncompleteTail("Display\n\n$$\nx +")).toBe("Display\n\n");
  });

  it("withholds math and diagram fences but lets code fences grow", () => {
    expect(trimIncompleteTail("Steps:\n\n```math\nf'(x) = \\lim_{h")).toBe(
      "Steps:\n\n"
    );
    expect(trimIncompleteTail("Map:\n\n``` Mermaid title\ngraph")).toBe(
      "Map:\n\n"
    );
    const code = "Code:\n\n```ts\nconst price = $$";
    expect(trimIncompleteTail(code)).toBe(code);
    const nested = "Code:\n\n````\n```\nstill code $$";
    expect(trimIncompleteTail(nested)).toBe(nested);
  });

  it("withholds a fence marker until its line is complete", () => {
    expect(trimIncompleteTail("So 2x.\n``")).toBe("So 2x.\n");
    expect(trimIncompleteTail("So 2x.\n```ma")).toBe("So 2x.\n");
    expect(trimIncompleteTail("Code:\n```ts\nlet a = 1;\n``")).toBe(
      "Code:\n```ts\nlet a = 1;\n"
    );
  });

  it("withholds an unclosed bold span within its paragraph", () => {
    expect(trimIncompleteTail("Step one.\n\n**Answ")).toBe("Step one.\n\n");
    expect(trimIncompleteTail("The **slope")).toBe("The ");
  });

  it("withholds a block marker until its content starts", () => {
    for (const marker of ["1", "12.", "3)", "-", "*", "+", ">", "##"]) {
      expect(trimIncompleteTail(`Steps:\n\n${marker}`)).toBe("Steps:\n\n");
    }
    const item = "Steps:\n\n1. Write";
    expect(trimIncompleteTail(item)).toBe(item);
  });

  it("withholds a table until a later line ends it", () => {
    const header = "Compare:\n\n| Rule | Result |";
    expect(trimIncompleteTail(header)).toBe("Compare:\n\n");
    expect(trimIncompleteTail(`${header}\n| --- | -`)).toBe("Compare:\n\n");
    const table = `${header}\n| --- | --- |\n| Power | $$nx^{n-1}$$ |`;
    for (const tail of ["", "\n", "\n| Sum"]) {
      expect(trimIncompleteTail(`${table}${tail}`)).toBe("Compare:\n\n");
    }
    const complete = `${table}\n\nAfter`;
    expect(trimIncompleteTail(complete)).toBe(complete);
    const prose = "| A pipe line\nthat is not a table.";
    expect(trimIncompleteTail(prose)).toBe(prose);
  });

  it("withholds an unclosed code span or link on the final line", () => {
    expect(trimIncompleteTail("Call `slope(")).toBe("Call ");
    for (const link of ["[Kemdik", "[Kemdikbud]", "[Kemdikbud](https://kem"]) {
      expect(trimIncompleteTail(`See ${link}`)).toBe("See ");
    }
  });

  it("drops a final character that may open the next delimiter", () => {
    expect(trimIncompleteTail("The slope is $")).toBe("The slope is ");
    expect(trimIncompleteTail("Where \\")).toBe("Where ");
    expect(trimIncompleteTail("And *")).toBe("And ");
    expect(trimIncompleteTail("A dollar $ in text")).toBe("A dollar $ in text");
  });
});
