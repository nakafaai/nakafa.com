import { describe, expect, it } from "@effect/vitest";
import { blocksOf } from "@repo/design-system/components/editor/blocks";
import { Array as Arr } from "effect";

describe("blocks of the saved words", () => {
  it("gives two equal paragraphs keys of their own, so both render", () => {
    const paragraphs = Arr.filter(
      blocksOf("Same line\n\nSame line"),
      ({ token }) => token.type === "paragraph"
    );

    expect(paragraphs).toHaveLength(2);
    expect(Arr.dedupe(Arr.map(paragraphs, ({ key }) => key))).toHaveLength(2);
  });

  it("gives every block of a text a key that no sibling shares", () => {
    const blocks = blocksOf("## Title\n\n- one\n- one\n\n\n&nbsp;\n\n> quote");
    const keys = Arr.map(blocks, ({ key }) => key);

    expect(Arr.dedupe(keys)).toHaveLength(Arr.length(keys));
  });
});
