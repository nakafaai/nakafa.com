// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  markAt,
  markExtension,
  markTokenizer,
} from "@repo/design-system/components/editor/marks";
import { Array as Arr, Option } from "effect";
import { Marked } from "marked-tiptap";

/** The pair a mark reads at the start of `src`, or none. */
const pair = (mark: Parameters<typeof markAt>[0], src: string) =>
  Option.getOrNull(markAt(mark, src));

describe("a mark", () => {
  it("is a pair of delimiters around words, read from the start of the text", () => {
    expect(pair("underline", "++under++ and more")).toEqual({
      raw: "++under++",
      words: "under",
    });
    expect(pair("highlight", "==two words== and more")).toEqual({
      raw: "==two words==",
      words: "two words",
    });
    expect(pair("underline", "++a **b** c++")).toEqual({
      raw: "++a **b** c++",
      words: "a **b** c",
    });
    expect(pair("underline", "++x++ and ++y++")).toEqual({
      raw: "++x++",
      words: "x",
    });
  });

  it("is only text when a delimiter stands alone or has a space inside it", () => {
    // `C++ and C++20` holds a pair of delimiters with a space after the opening
    // one, and `a == b == c` holds one with a space on both sides.
    for (const src of [
      "++ and C++",
      "++x ++",
      "++ x++",
      "++ ++",
      "++++",
      "++",
      "++unclosed",
      "+x+",
    ]) {
      expect(pair("underline", src)).toBeNull();
    }
    for (const src of [
      "== b == c",
      "==b ==",
      "== b==",
      "====",
      "==",
      "==unclosed",
      "=x=",
      "==a = b==",
    ]) {
      expect(pair("highlight", src)).toBeNull();
    }
  });

  it("is only text when the delimiters are not at the start", () => {
    expect(pair("underline", "x ++under++")).toBeNull();
    expect(pair("highlight", "x ==high==")).toBeNull();
  });
});

describe("the tokenizers of a mark", () => {
  it("give the editor the mark with its words lexed again inside it", () => {
    const lexer = {
      blockTokens: () => [],
      inlineTokens: (src: string) => [{ raw: src, text: src, type: "text" }],
    };
    const underline = markTokenizer("underline");

    expect(underline.name).toBe("underline");
    expect(underline.level).toBe("inline");
    expect(underline.tokenize("++a b++ c", [], lexer)).toEqual({
      raw: "++a b++",
      text: "a b",
      tokens: [{ raw: "a b", text: "a b", type: "text" }],
      type: "underline",
    });
    expect(underline.tokenize("C++ and C++20", [], lexer)).toBeUndefined();
  });

  it("make a `marked` lex a mark, and leave a delimiter that stands alone as text", () => {
    const marked = new Marked({
      extensions: [markExtension("underline"), markExtension("highlight")],
    });
    const types = (src: string) => {
      const [first] = marked.lexer(src);

      return first?.type === "paragraph"
        ? Arr.map(first.tokens ?? [], (inner) => inner.type)
        : [];
    };

    expect(types("I use C++ and C++20, a == b == c")).toEqual(["text"]);
    expect(types("a ++under++ b ==high== c")).toEqual([
      "text",
      "underline",
      "text",
      "highlight",
      "text",
    ]);
  });
});
