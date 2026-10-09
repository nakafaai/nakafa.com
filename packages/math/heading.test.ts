import { describe, expect, it } from "@effect/vitest";
import { createHeadingId, createHeadingLabel } from "@repo/math/heading";

describe("createHeadingLabel", () => {
  it("keeps the source of inline and block math components", () => {
    expect(createHeadingLabel('Area <InlineMath math="A" /> circle')).toBe(
      "Area A circle"
    );
    expect(createHeadingLabel('<BlockMath math="x^2" />')).toBe("x^2");
  });

  it("names a code block component with a marker", () => {
    expect(createHeadingLabel("Example <CodeBlock data={[]} />")).toBe(
      "Example [Code]"
    );
  });

  it("removes other markup and LaTeX command names", () => {
    expect(createHeadingLabel("<strong>Sudut</strong> \\alpha")).toBe(
      "Sudut alpha"
    );
  });

  it("returns an empty label for an empty heading", () => {
    expect(createHeadingLabel("")).toBe("");
  });
});

describe("createHeadingId", () => {
  it("slugs the readable label instead of the MDX source", () => {
    expect(createHeadingId('Area <InlineMath math="A" /> Circle')).toBe(
      "area-a-circle"
    );
  });

  it("joins each run of whitespace with one hyphen", () => {
    expect(createHeadingId("Sudut   Pusat")).toBe("sudut-pusat");
  });
});
