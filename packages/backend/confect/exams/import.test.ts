import { describe, expect, it } from "@effect/vitest";
import { documentOf, importedParts } from "@repo/backend/confect/exams/import";
import { Option } from "effect";

describe("exams/import documentOf", () => {
  it("writes each line as a paragraph and each formula between \\( and \\) as inline math", () => {
    expect(
      documentOf(
        "Diketahui \\(f(x) = x^2\\) untuk semua x.\n\n  Tentukan \\(f(3)\\).  "
      )
    ).toEqual({
      content: [
        {
          content: [
            { text: "Diketahui ", type: "text" },
            { attrs: { latex: "f(x) = x^2" }, type: "mathInline" },
            { text: " untuk semua x.", type: "text" },
          ],
          type: "paragraph",
        },
        {
          content: [
            { text: "Tentukan ", type: "text" },
            { attrs: { latex: "f(3)" }, type: "mathInline" },
            { text: ".", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });

  it("writes a formula alone on its line between \\[ and \\] as a formula block, and one inside a line as inline math", () => {
    expect(
      documentOf("\\[ \\int_0^1 x\\,dx \\]\nNilai \\[x\\] adalah")
    ).toEqual({
      content: [
        { attrs: { latex: "\\int_0^1 x\\,dx" }, type: "mathBlock" },
        {
          content: [
            { text: "Nilai ", type: "text" },
            { attrs: { latex: "x" }, type: "mathInline" },
            { text: " adalah", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });

  it("keeps the marks as text when a formula is never closed or holds nothing, so nothing of the file is lost", () => {
    expect(documentOf("Harga \\(naik\nKosong \\( \\) di sini")).toEqual({
      content: [
        {
          content: [{ text: "Harga \\(naik", type: "text" }],
          type: "paragraph",
        },
        {
          content: [
            { text: "Kosong ", type: "text" },
            { text: "\\( \\)", type: "text" },
            { text: " di sini", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });

  it("writes a line that holds two formula blocks as a paragraph of inline formulas", () => {
    expect(documentOf("\\[a\\] dan \\[b\\]").content).toEqual([
      {
        content: [
          { attrs: { latex: "a" }, type: "mathInline" },
          { text: " dan ", type: "text" },
          { attrs: { latex: "b" }, type: "mathInline" },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("writes an empty paragraph for a formula block that holds nothing and for an empty text", () => {
    expect(documentOf("\\[\\]")).toEqual({
      content: [
        { content: [{ text: "\\[\\]", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    });
    expect(documentOf(" \n ")).toEqual({
      content: [{ type: "paragraph" }],
      type: "doc",
    });
  });
});

describe("exams/import importedParts", () => {
  it("makes a single-answer choice with one option for each option read, and the key of the marked option", () => {
    const parts = importedParts({
      answer: 1,
      options: ["4", "\\(5\\)", "6"],
      prompt: "Berapa 2 + 3?",
    });
    expect(Option.getOrThrow(parts)).toEqual({
      answers: [
        {
          id: "choice",
          kind: "choice",
          label: "Answer",
          maxChoices: 1,
          minChoices: 1,
          options: [
            { id: "option-1", label: documentOf("4") },
            { id: "option-2", label: documentOf("\\(5\\)") },
            { id: "option-3", label: documentOf("6") },
          ],
          shuffle: false,
        },
      ],
      key: [{ correct: ["option-2"], interaction: "choice", kind: "choice" }],
      prompt: documentOf("Berapa 2 + 3?"),
    });
  });

  it("leaves the key out when the file marks no option, or marks one that does not exist", () => {
    const unmarked = importedParts({
      answer: null,
      options: ["A", "B"],
      prompt: "Soal",
    });
    const missing = importedParts({
      answer: 2,
      options: ["A", "B"],
      prompt: "Soal",
    });
    expect(Option.map(unmarked, (parts) => parts.key)).toEqual(
      Option.some(null)
    );
    expect(Option.map(missing, (parts) => parts.key)).toEqual(
      Option.some(null)
    );
  });

  it("leaves out a question that is not a choice of two to five options", () => {
    expect(
      importedParts({ answer: 0, options: ["Saja"], prompt: "Satu" })
    ).toEqual(Option.none());
    expect(
      importedParts({
        answer: 0,
        options: ["A", "B", "C", "D", "E", "F"],
        prompt: "Enam",
      })
    ).toEqual(Option.none());
    expect(
      importedParts({ answer: null, options: [], prompt: "Uraian" })
    ).toEqual(Option.none());
  });
});
