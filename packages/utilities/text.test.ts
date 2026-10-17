import { describe, expect, it } from "@effect/vitest";
import { truncateText, utf8Bytes } from "@repo/utilities/text";

describe("text", () => {
  it("counts the UTF-8 bytes of a text, so a character of two or more bytes counts as such", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é€😀")).toBe(2 + 3 + 4);
  });

  it("keeps short text unchanged", () => {
    expect(truncateText({ text: "Short preview", maxLength: 20 })).toBe(
      "Short preview"
    );
  });

  it("truncates long text at the requested length", () => {
    expect(truncateText({ text: "Long preview text", maxLength: 12 })).toBe(
      "Long preview…"
    );
  });

  it("uses the default preview length when no limit is provided", () => {
    const text = `${"a".repeat(205)} tail`;

    expect(truncateText({ text })).toBe(`${"a".repeat(200)}…`);
  });
});
