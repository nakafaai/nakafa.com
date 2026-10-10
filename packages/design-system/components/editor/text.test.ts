import { describe, expect, it } from "@effect/vitest";
import {
  canSaveText,
  flattenText,
  toDocument,
} from "@repo/design-system/components/editor/text";

describe("editor text", () => {
  describe("flattenText", () => {
    it("joins lines with one space", () => {
      expect(flattenText("first line\nsecond line")).toBe(
        "first line second line"
      );
      expect(flattenText("a\r\n\r\n\r\nb")).toBe("a b");
    });

    it("collapses every run of white space to one space", () => {
      expect(flattenText("one \t  two  three")).toBe("one two three");
    });

    it("keeps the edges as one space so pasted words stay apart", () => {
      expect(flattenText("\n  middle \n")).toBe(" middle ");
    });

    it("leaves a flat line and an empty text unchanged", () => {
      expect(flattenText("already flat")).toBe("already flat");
      expect(flattenText("")).toBe("");
    });
  });

  describe("canSaveText", () => {
    it("refuses text without a visible character", () => {
      expect(canSaveText("", 10)).toBe(false);
      expect(canSaveText(" \n\t ", 10)).toBe(false);
    });

    it("accepts text up to the limit and refuses one character more", () => {
      expect(canSaveText("a", 10)).toBe(true);
      expect(canSaveText("a".repeat(10), 10)).toBe(true);
      expect(canSaveText("a".repeat(11), 10)).toBe(false);
    });

    it("measures the text without the white space at its edges", () => {
      expect(canSaveText(`  ${"a".repeat(10)}  `, 10)).toBe(true);
      expect(canSaveText(`  ${"a".repeat(11)}  `, 10)).toBe(false);
    });
  });

  describe("toDocument", () => {
    it("holds the text in one paragraph", () => {
      expect(toDocument("Prefers examples first")).toEqual({
        content: [
          {
            content: [{ text: "Prefers examples first", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      });
    });

    it("keeps markup as plain text", () => {
      expect(toDocument("<b>bold</b> & more")).toEqual({
        content: [
          {
            content: [{ text: "<b>bold</b> & more", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      });
    });

    it("holds no text node for an empty text", () => {
      expect(toDocument("")).toEqual({
        content: [{ content: [], type: "paragraph" }],
        type: "doc",
      });
    });
  });
});
