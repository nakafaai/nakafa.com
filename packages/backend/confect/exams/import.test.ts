import { describe, expect, it } from "@effect/vitest";
import { documentOf, importedParts } from "@repo/backend/confect/exams/import";
import { Array as Arr, Option } from "effect";

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

/** The figure a question carries: an image of the exam with its size and its words. */
const triangle = {
  alt: "  Segitiga siku-siku ABC  ",
  asset: "asset-1",
  height: 300,
  width: 400,
};

describe("exams/import figures", () => {
  it("draws a figure where its mark stands, in the prompt and in an option, and drops a mark that names no figure", () => {
    expect(
      documentOf(
        "Perhatikan gambar.\n{{figure:1}}\n{{figure:2}}\nHitung luasnya.",
        [triangle]
      )
    ).toEqual({
      content: [
        {
          content: [{ text: "Perhatikan gambar.", type: "text" }],
          type: "paragraph",
        },
        {
          attrs: {
            alt: "Segitiga siku-siku ABC",
            asset: "asset-1",
            height: 300,
            width: 400,
          },
          type: "image",
        },
        {
          content: [{ text: "Hitung luasnya.", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
    const parts = Option.getOrThrow(
      importedParts(
        {
          explanation: "",
          answer: null,
          options: ["{{figure:1}}", "Bukan"],
          prompt: "Pilih",
        },
        [triangle]
      )
    );
    expect(parts.answers[0].options[0]?.label.content[0]).toMatchObject({
      type: "image",
    });
  });

  it("keeps a line that only looks like a mark as text, and writes an empty paragraph when only a missing figure was left", () => {
    expect(documentOf("{{figure:satu}}").content).toEqual([
      {
        content: [{ text: "{{figure:satu}}", type: "text" }],
        type: "paragraph",
      },
    ]);
    expect(documentOf("{{figure:3}}", [triangle])).toEqual({
      content: [{ type: "paragraph" }],
      type: "doc",
    });
  });
});

describe("exams/import importedParts", () => {
  it("makes a single-answer choice with one option for each option read, and the key of the marked option", () => {
    const parts = importedParts(
      {
        explanation: "",
        answer: 1,
        options: ["4", "\\(5\\)", "6"],
        prompt: "Berapa 2 + 3?",
      },
      []
    );
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
      explanation: documentOf(""),
      key: [{ correct: ["option-2"], interaction: "choice", kind: "choice" }],
      prompt: documentOf("Berapa 2 + 3?"),
    });
  });

  it("copies the worked solution the file prints into the explanation, with its formulas and figures", () => {
    const parts = Option.getOrThrow(
      importedParts(
        {
          answer: 1,
          explanation: "Luas \\(= \\frac{1}{2} a t\\)\n{{figure:1}}",
          options: ["4", "6"],
          prompt: "Hitung luasnya.",
        },
        [triangle]
      )
    );
    expect(parts.explanation).toEqual(
      documentOf("Luas \\(= \\frac{1}{2} a t\\)\n{{figure:1}}", [triangle])
    );
    expect(Arr.map(parts.explanation.content, (block) => block.type)).toEqual([
      "paragraph",
      "image",
    ]);
  });

  it("leaves the key out when the file marks no option, or marks one that does not exist", () => {
    const unmarked = importedParts(
      {
        explanation: "",
        answer: null,
        options: ["A", "B"],
        prompt: "Soal",
      },
      []
    );
    const missing = importedParts(
      {
        explanation: "",
        answer: 2,
        options: ["A", "B"],
        prompt: "Soal",
      },
      []
    );
    expect(Option.map(unmarked, (parts) => parts.key)).toEqual(
      Option.some(null)
    );
    expect(Option.map(missing, (parts) => parts.key)).toEqual(
      Option.some(null)
    );
  });

  it("leaves out a question that is not a choice of two to five options", () => {
    expect(
      importedParts(
        { explanation: "", answer: 0, options: ["Saja"], prompt: "Satu" },
        []
      )
    ).toEqual(Option.none());
    expect(
      importedParts(
        {
          explanation: "",
          answer: 0,
          options: ["A", "B", "C", "D", "E", "F"],
          prompt: "Enam",
        },
        []
      )
    ).toEqual(Option.none());
    expect(
      importedParts(
        { explanation: "", answer: null, options: [], prompt: "Uraian" },
        []
      )
    ).toEqual(Option.none());
  });
});
