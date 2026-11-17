import { describe, expect, it } from "@effect/vitest";
import { sizeSvg } from "@repo/design-system/lib/mermaid/size";

/** The root Mermaid writes for a diagram that fits its column, with a maximum width. */
const FITTED =
  '<svg id="diagram" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 812px;" viewBox="-8 -8 812 462"><g><rect width="10" height="10"/></g></svg>';

describe("size of a Mermaid SVG", () => {
  it("opens the diagram fitted to its box, never past its natural size and never past the box", () => {
    const sized = sizeSvg(FITTED);

    expect(sized).toContain(' width="812"');
    expect(sized).toContain(' height="462"');
    expect(sized).toContain('viewBox="-8 -8 812 462"');
    expect(sized).toContain('style="max-width: 100cqw; max-height: 100cqh;"');
    expect(sized).not.toContain("min-width");
    expect(sized).not.toContain("min-height");
    expect(sized).not.toContain("812px");
    expect(sized).toContain('<rect width="10" height="10"></rect>');
  });

  it("draws a zoomed diagram at that multiple of its natural size", () => {
    const sized = sizeSvg(FITTED, 1.5);

    expect(sized).toContain(' width="1218"');
    expect(sized).toContain(' height="693"');
    expect(sized).not.toContain("style=");
  });

  it("keeps an SVG without a viewBox as Mermaid wrote it", () => {
    const svg = '<svg width="100%"><g></g></svg>';

    expect(sizeSvg(svg)).toBe(svg);
    expect(sizeSvg(svg, 2)).toBe(svg);
  });
});
