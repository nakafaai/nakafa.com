import { describe, expect, it } from "@effect/vitest";
import { closeMathCopyToSnippets } from "@repo/design-system/lib/markdown/snippet";
import { Array as Arr } from "effect";
import katex from "katex";

describe("closeMathCopyToSnippets", () => {
  it("closes the MathML copy of an inline formula and keeps the copy a reader sees", () => {
    const html = closeMathCopyToSnippets(
      katex.renderToString("\\sigma > 0", { throwOnError: false })
    );

    expect(html).toContain('<span class="katex-mathml" data-nosnippet="">');
    expect(html).not.toContain('<span class="katex-mathml">');
    expect(html).toContain('<span class="katex-html" aria-hidden="true">');
  });

  it("closes the MathML copy of every formula in a display block", () => {
    const html = closeMathCopyToSnippets(
      Arr.join(
        [
          katex.renderToString("x^2", { displayMode: true }),
          katex.renderToString("y", { displayMode: true }),
        ],
        ""
      )
    );

    expect(html.match(/data-nosnippet=""/gu)).toHaveLength(2);
  });

  it("leaves markup that holds no formula as it is", () => {
    expect(closeMathCopyToSnippets("<span>plain</span>")).toBe(
      "<span>plain</span>"
    );
  });

  it("closes a copy once, so drawing it again changes nothing", () => {
    const once = closeMathCopyToSnippets(katex.renderToString("a"));

    expect(closeMathCopyToSnippets(once)).toBe(once);
  });
});
