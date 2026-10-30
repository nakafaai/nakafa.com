// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { spokenText } from "@repo/design-system/lib/markdown/spoken";

describe("authored Markdown as spoken words", () => {
  it("speaks a label drawn only as math", () => {
    expect(spokenText("$10$")).toBe("10");
    expect(spokenText("$\\frac{1}{2}$")).toBe(
      "start fraction, 1, divided by, 2, end fraction"
    );
  });

  it("keeps the words around a formula, on its own line or inline, without their marks", () => {
    expect(spokenText("**Nilai** $x^2$ adalah")).toBe(
      "Nilai x, squared adalah"
    );
    expect(spokenText("$$y = 2$$")).toBe("y, equals, 2");
    expect(spokenText("Satu\n\nDua")).toBe("Satu Dua");
  });

  it("keeps the TeX of a formula that KaTeX cannot read", () => {
    expect(spokenText("$\\notacommand{x}$")).toBe("\\notacommand{x}");
  });
});
