import { describe, expect, it } from "@effect/vitest";
import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import {
  labelText,
  letterScript,
  optionLetter,
} from "@repo/backend/confect/exams/letters";
import { Array as Arr } from "effect";

/** A label of one paragraph that holds `text`. */
const label = (text: string): typeof ContentDocumentSchema.Type => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** The labels of a set, one per text. */
const labels = (texts: readonly string[]) => Arr.map(texts, label);

describe("the plain text of a label", () => {
  it("reads the text of a label's paragraphs, and nothing of an empty one", () => {
    expect(labelText(label("Benar"))).toBe("Benar");
    expect(
      labelText({
        content: [
          { content: [{ text: "Salah", type: "text" }], type: "paragraph" },
          { content: [{ text: "sekali", type: "text" }], type: "paragraph" },
        ],
        type: "doc",
      })
    ).toBe("Salah sekali");
    expect(labelText({ content: [{ type: "paragraph" }], type: "doc" })).toBe(
      ""
    );
    // A line break and a formula block hold no text of a label.
    expect(
      labelText({
        content: [
          {
            content: [{ text: "Benar", type: "text" }, { type: "hardBreak" }],
            type: "paragraph",
          },
          { attrs: { latex: "x^2" }, type: "mathBlock" },
        ],
        type: "doc",
      })
    ).toBe("Benar");
  });
});

describe("the script that names a set of options", () => {
  it("is Arabic when most letters of the labels are Arabic", () => {
    expect(letterScript(labels(["كِتَابٌ", "قَلَمٌ", "بَيْتٌ"]))).toBe("arabic");
    expect(letterScript(labels(["مَدْرَسَةٌ", "school", "بَابٌ"]))).toBe("arabic");
  });

  it("is Latin for a set in another script, or a mixed set most of whose letters are Latin", () => {
    expect(letterScript(labels(["Buku", "Pensil", "Rumah"]))).toBe("latin");
    expect(
      letterScript(labels(["The book (كتاب)", "The pen", "The house"]))
    ).toBe("latin");
  });

  it("is Latin for a set without a letter, such as numbers", () => {
    expect(letterScript(labels(["12", "24", "36"]))).toBe("latin");
    expect(letterScript([])).toBe("latin");
  });
});

describe("the letter of an option", () => {
  it("names a Latin set from A", () => {
    expect(Arr.makeBy(5, (index) => optionLetter(index, "latin"))).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
  });

  it("names an Arabic set in abjad order", () => {
    expect(Arr.makeBy(5, (index) => optionLetter(index, "arabic"))).toEqual([
      "أ",
      "ب",
      "ج",
      "د",
      "هـ",
    ]);
  });

  it("names an option of an Arabic set past the abjad as a Latin set names its place", () => {
    expect(optionLetter(28, "arabic")).toBe(optionLetter(28, "latin"));
    expect(optionLetter(27, "arabic")).toBe("غ");
  });
});
