import { describe, expect, it } from "@effect/vitest";
import { drawMath } from "@repo/design-system/lib/markdown/draw";
import { MATH_ERROR_COLOR } from "@repo/design-system/lib/prose";

describe("drawMath", () => {
  it("draws an inline formula and a display formula", () => {
    const inline = drawMath("x^2", false);
    const display = drawMath("x^2", true);

    expect(inline).toContain('class="katex"');
    expect(inline).not.toContain("katex-display");
    expect(display).toContain("katex-display");
  });

  it("draws a formula it cannot read in the error color instead of throwing", () => {
    expect(drawMath("\\frac{", false)).toContain(MATH_ERROR_COLOR);
    expect(drawMath("\\frac{", false, "#123456")).toContain("#123456");
  });

  it("keeps trust off, so a formula cannot write a link", () => {
    expect(drawMath("\\href{https://example.com}{x}", false)).not.toContain(
      "<a "
    );
  });
});
