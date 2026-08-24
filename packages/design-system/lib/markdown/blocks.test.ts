import {
  parseMarkdownIntoBlocks,
  readMarkdownBlocks,
} from "@repo/design-system/lib/markdown/blocks";
import { Lexer, type Tokens } from "marked";
import { afterEach, describe, expect, it, vi } from "vitest";

function mockLexerBlocks(...blocks: string[]) {
  const tokens = Object.assign(
    blocks.map(
      (raw): Tokens.Space => ({
        raw,
        type: "space",
      })
    ),
    { links: {} }
  );
  vi.spyOn(Lexer, "lex").mockReturnValue(tokens);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("markdown blocks", () => {
  it("preserves marked block boundaries", () => {
    expect(parseMarkdownIntoBlocks("First\n\nSecond\n")).toEqual([
      "First",
      "\n\n",
      "Second\n",
    ]);
  });

  it("rejoins display math split by the markdown lexer", () => {
    mockLexerBlocks("$$\nx + 1", "$$\n");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "$$\nx + 1$$\n",
    ]);
  });

  it("keeps unrelated standalone delimiters separate", () => {
    mockLexerBlocks("plain", "$$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "plain",
      "$$",
    ]);
  });

  it("keeps a standalone delimiter after a closed math block separate", () => {
    mockLexerBlocks("$$ closed $$", "$$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "$$ closed $$",
      "$$",
    ]);
  });

  it("ignores an empty preceding lexer token before a standalone delimiter", () => {
    mockLexerBlocks("", "$$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([""]);
  });

  it("rejoins a continuation that owns one closing delimiter", () => {
    mockLexerBlocks("$$\nx +", " 1 $$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "$$\nx + 1 $$",
    ]);
  });

  it("ignores an empty preceding lexer token before a continuation", () => {
    mockLexerBlocks("", "tail $$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([""]);
  });

  it("keeps a new math block separate from an unclosed block", () => {
    mockLexerBlocks("$$ open", "$$ new $$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "$$ open",
      "$$ new $$",
    ]);
  });

  it("keeps multiple continuation delimiters separate", () => {
    mockLexerBlocks("$$ open", "tail $$ and $$");

    expect(parseMarkdownIntoBlocks("ignored by mocked lexer")).toEqual([
      "$$ open",
      "tail $$ and $$",
    ]);
  });

  it("gives duplicate blocks distinct stable identities", () => {
    const first = readMarkdownBlocks("answer", "Same\n\nSame");
    const second = readMarkdownBlocks("answer", "Same\n\nSame");

    expect(first).toEqual(second);
    expect(first.map(({ content }) => content)).toEqual([
      "Same",
      "\n\n",
      "Same",
    ]);
    expect(new Set(first.map(({ key }) => key)).size).toBe(first.length);
  });
});
