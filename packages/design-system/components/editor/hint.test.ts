import { describe, expect, it } from "@effect/vitest";
import { isEmptyDocument } from "@repo/design-system/components/editor/hint";
import { reader } from "@repo/design-system/components/editor/plain";

describe("isEmptyDocument", () => {
  it("shows the hint for a memory with no block, or with only spacing", () => {
    expect(isEmptyDocument(reader.lexer(""))).toBe(true);
    expect(isEmptyDocument(reader.lexer("\n\n"))).toBe(true);
  });

  it("shows the hint for an empty paragraph, heading or code block, as the editor does", () => {
    expect(isEmptyDocument(reader.lexer("&nbsp;"))).toBe(true);
    expect(isEmptyDocument(reader.lexer("##"))).toBe(true);
    expect(isEmptyDocument(reader.lexer("```\n```"))).toBe(true);
  });

  it("shows the hint for empty blocks in a row, where the editor marks its first one", () => {
    expect(isEmptyDocument(reader.lexer("&nbsp;\n\n&nbsp;"))).toBe(true);
  });

  it("shows no hint for a block with words, a divider or a list, where the editor marks none", () => {
    expect(isEmptyDocument(reader.lexer("Milk"))).toBe(false);
    expect(isEmptyDocument(reader.lexer("&nbsp;\n\nMilk"))).toBe(false);
    expect(isEmptyDocument(reader.lexer("---"))).toBe(false);
    expect(isEmptyDocument(reader.lexer("- "))).toBe(false);
  });
});
