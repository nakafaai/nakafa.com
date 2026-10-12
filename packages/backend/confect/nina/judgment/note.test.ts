import { describe, expect, it } from "@effect/vitest";
import { noteText } from "@repo/backend/confect/nina/judgment/note";

describe("the text of a note", () => {
  it("is the sentence and then the quote, each on a line of its own, whatever their language", () => {
    expect(noteText({ quote: "aku kelas 12", text: "Kelas 12." })).toBe(
      "Note: Kelas 12.\nQuote: aku kelas 12"
    );
    expect(noteText({ quote: "高校三年生です", text: "高校三年生。" })).toBe(
      "Note: 高校三年生。\nQuote: 高校三年生です"
    );
  });
});
