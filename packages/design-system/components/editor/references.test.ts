// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { decodeReferences } from "@repo/design-system/components/editor/references";
import { decodeHtmlEntities } from "@tiptap/core";
import { Array as Arr } from "effect";

describe("decodeReferences", () => {
  it("reads the references the writer puts in text as the editor does, and no others", () => {
    const references = [
      "&amp;",
      "&lt;b&gt;",
      "&quot;",
      "&#38;",
      "&#x26;",
      "&#X26;",
      "&#128; &#150; &#159;",
      "&#0; &#xD800; &#1114112; &#xFFFFFF;",
      "&#12345678; &#xFFFFFFF;",
      "&copy; &nbsp;x &Amp; &AMP;",
      "&amp;lt; and &#38;amp;",
      "a & b; &",
    ];

    expect(
      Arr.filter(
        references,
        (reference) =>
          decodeReferences(reference) !== decodeHtmlEntities(reference)
      )
    ).toEqual([]);
  });

  it("reads a reference once, so what it stands for is never read as a reference again", () => {
    expect(decodeReferences("&amp;lt;")).toBe("&lt;");
    expect(decodeReferences("&#38;#38;")).toBe("&#38;");
  });
});
