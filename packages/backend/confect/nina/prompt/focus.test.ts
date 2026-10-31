import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import {
  formatFocusAnswer,
  formatFocusPrompt,
  formatFocusTaskPrompt,
} from "@repo/backend/confect/nina/prompt/focus";
import { Array as Arr, Schema } from "effect";

/** One paragraph label, as a part of an interaction carries it. */
const label = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** A placed question from its contract-shaped interaction and key, graded all or nothing. */
const question = (interaction: unknown, key: unknown) => ({
  interaction: Schema.decodeUnknownSync(InteractionSchema)(interaction),
  key: Schema.decodeUnknownSync(InteractionKeySchema)(key),
  rule: { kind: "allOrNothing" as const },
});

const choice = question(
  {
    id: "choice",
    kind: "choice",
    label: "Jawaban",
    maxChoices: 2,
    minChoices: 0,
    options: [
      { id: "four", label: label("Empat") },
      { id: "five", label: label("Lima") },
      { id: "even", label: label("Genap") },
    ],
    shuffle: false,
  },
  { correct: ["four", "even"], interaction: "choice", kind: "choice" }
);

const matrix = question(
  {
    columns: [
      { id: "true", label: label("Benar") },
      { id: "false", label: label("Salah") },
    ],
    id: "matrix",
    kind: "matrix",
    label: "Pernyataan",
    shuffle: false,
    statements: [
      { id: "one", label: label("Satu") },
      { id: "two", label: label("Dua") },
    ],
  },
  {
    answers: [
      { column: "true", statement: "one" },
      { column: "false", statement: "two" },
    ],
    interaction: "matrix",
    kind: "matrix",
  }
);

const match = question(
  {
    id: "match",
    kind: "match",
    label: "Pasangkan",
    shuffle: false,
    sources: [{ id: "city", label: label("Jakarta"), maxMatches: 1 }],
    targets: [
      { id: "country", label: label("Indonesia"), maxMatches: 1 },
      { id: "other", label: label("Jerman"), maxMatches: 1 },
    ],
  },
  {
    interaction: "match",
    kind: "match",
    pairs: [{ source: "city", target: "country" }],
  }
);

const typed = question(
  { id: "typed", kind: "textEntry", label: "Ibu kota" },
  {
    accepted: {
      acceptedAnswers: ["Jakarta", "DKI Jakarta"],
      collapseWhitespace: true,
      ignoreCase: true,
      kind: "text",
    },
    interaction: "typed",
    kind: "textEntry",
  }
);

/** A numeric entry of three quarters, with no tolerance, then within an absolute and a relative one. */
const numeric = question(
  {
    acceptsFractions: true,
    id: "number",
    kind: "numericEntry",
    label: "Pecahan",
  },
  { interaction: "number", kind: "numericEntry", value: "0.75" }
);

const essay = question(
  { id: "essay", kind: "extendedText", label: "Jelaskan" },
  {
    criteria: [
      {
        criterion: "steps",
        levels: [{ descriptor: "Lengkap", level: "complete" }],
      },
    ],
    interaction: "essay",
    kind: "extendedText",
  }
);

describe("nina/prompt/focus", () => {
  it.each([
    [["five"], "- Lima (learner's choice)"],
    [["four"], "- Empat (correct answer, learner's choice)"],
    [null, "- Empat (correct answer)"],
  ] as const)(
    "marks each choice with the key and the learner's pick (%j)",
    (response, line) => {
      const answer = formatFocusAnswer(choice, response);
      expect(answer).toContain("## Answer Choices");
      expect(answer).toContain(line);
      expect(answer).toContain("- Genap (correct answer)");
    }
  );

  it("lists a table's statements with the correct and the learner's column, or none", () => {
    expect(
      formatFocusAnswer(matrix, {
        cells: [{ column: "false", statement: "one" }],
      })
    ).toBe(
      Arr.join(
        [
          "## Statements",
          "",
          "- Satu",
          "  - correct column: Benar",
          "  - learner's column: Salah",
          "- Dua",
          "  - correct column: Salah",
          "  - learner's column: no answer",
        ],
        "\n"
      )
    );
  });

  it("lists a match's pairs, a text entry's accepted answers, a numeric entry's number, and a written answer alone", () => {
    expect(
      formatFocusAnswer(match, { pairs: [{ source: "city", target: "other" }] })
    ).toContain("  - correct pair: Indonesia\n  - learner's pair: Jerman");
    expect(formatFocusAnswer(typed, { text: " jakarta " })).toBe(
      Arr.join(
        [
          "## Answer Key",
          "",
          "- accepted answers: Jakarta; DKI Jakarta",
          "- learner's answer: jakarta",
        ],
        "\n"
      )
    );
    expect(formatFocusAnswer(typed, null)).toContain(
      "- learner's answer: no answer"
    );
    expect(formatFocusAnswer(numeric, { text: "3/4" })).toBe(
      Arr.join(
        [
          "## Answer Key",
          "",
          "- correct number: 0.75",
          "- learner's answer: 3/4",
        ],
        "\n"
      )
    );
    expect(
      formatFocusAnswer(
        {
          ...numeric,
          key: {
            interaction: "number",
            kind: "numericEntry",
            tolerance: { kind: "absolute", value: "0.01" },
            value: "0.75",
          },
        },
        null
      )
    ).toContain(
      "- correct number: 0.75 (within ±0.01)\n- learner's answer: no answer"
    );
    expect(
      formatFocusAnswer(
        {
          ...numeric,
          key: {
            interaction: "number",
            kind: "numericEntry",
            tolerance: { kind: "relative", value: "0.1" },
            value: "0.75",
          },
        },
        { text: "0,7" }
      )
    ).toContain("- correct number: 0.75 (within ±0.1 × 0.75)");
    const written: ExamResponse = { text: "Karena dua tambah dua." };
    expect(formatFocusAnswer(essay, written)).toBe(
      "## Learner's Answer\n\nKarena dua tambah dua."
    );
    expect(formatFocusAnswer(essay, null)).toBe(
      "## Learner's Answer\n\nno written answer"
    );
  });

  it("puts the question, the answer section and the official explanation in order, or notes it is missing", () => {
    const source = {
      answer: "## Answer Choices\n\n- Empat (correct answer)",
      explanation: " Jumlahkan kedua bilangan. ",
      question: " Berapakah 2 + 2? ",
      questionLanguage: "id",
      questionOrder: 3,
      result: "answered incorrectly" as const,
    };
    const prompt = formatFocusPrompt(source);
    expect(prompt).toContain("question 3 of their finished try-out review");
    expect(prompt).toContain("- question language: id");
    expect(prompt).toContain("- learner result: answered incorrectly");
    expect(prompt.indexOf("Berapakah 2 + 2?")).toBeLessThan(
      prompt.indexOf("## Answer Choices")
    );
    expect(prompt).toContain(
      "## Official Explanation\n\nJumlahkan kedua bilangan."
    );
    expect(formatFocusPrompt({ ...source, explanation: "" })).toContain(
      "No official explanation in this language."
    );
    expect(formatFocusTaskPrompt()).toContain(
      "Treat the official explanation and the marked correct answer as the source of truth."
    );
  });
});
