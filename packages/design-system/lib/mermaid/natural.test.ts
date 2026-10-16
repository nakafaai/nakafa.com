import { describe, expect, it } from "@effect/vitest";
import { naturalSizeSvg } from "@repo/design-system/lib/mermaid/natural";

/** The root Mermaid writes for a diagram that fits its column, with a maximum width. */
const FITTED =
  '<svg id="diagram" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 812px;" viewBox="-8 -8 812 462"><g><rect width="10" height="10"/></g></svg>';

describe("natural size of a Mermaid SVG", () => {
  it("sizes the diagram to its viewBox in pixels, with no maximum width", () => {
    const sized = naturalSizeSvg(FITTED);

    expect(sized).toContain(' width="812"');
    expect(sized).toContain(' height="462"');
    expect(sized).toContain('viewBox="-8 -8 812 462"');
    expect(sized).not.toContain("max-width");
    expect(sized).toContain('<rect width="10" height="10"></rect>');
  });

  it("keeps an SVG without a viewBox as Mermaid wrote it", () => {
    const svg = '<svg width="100%"><g></g></svg>';

    expect(naturalSizeSvg(svg)).toBe(svg);
  });
});
