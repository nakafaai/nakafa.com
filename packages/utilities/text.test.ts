import { describe, expect, it } from "@effect/vitest";
import { utf8Bytes } from "@repo/utilities/text";

describe("text", () => {
  it("counts the UTF-8 bytes of a text, so a character of two or more bytes counts as such", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é€😀")).toBe(2 + 3 + 4);
  });
});
