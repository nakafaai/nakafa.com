import { describe, expect, it } from "@effect/vitest";
import type { NinaFocusSource } from "@repo/backend/confect/nina/contract/focus";
import {
  formatFocusPrompt,
  formatFocusTaskPrompt,
} from "@repo/backend/confect/nina/prompt/focus";
import { Effect } from "effect";

const choice = {
  questionOrder: 3,
  questionLocale: "id",
  questionMdx: "Berapakah $$2 + 2$$?",
  explanationMdx: "### Langkah\n\nJumlahkan kedua bilangan.",
  responseSpec: {
    kind: "single-choice",
    options: [
      { isCorrect: false, label: "Lima", optionKey: "b", order: 2 },
      { isCorrect: true, label: "Empat", optionKey: "a", order: 1 },
      { isCorrect: false, label: "Tiga", optionKey: "c", order: 3 },
    ],
  },
  selection: { kind: "single-choice", optionKey: "b" },
  isCorrect: false,
} satisfies NinaFocusSource;

describe("formatFocusPrompt", () => {
  it.effect(
    "states the question, every choice in order and the learner's wrong pick",
    () =>
      Effect.gen(function* () {
        const prompt = yield* formatFocusPrompt(choice);

        expect(prompt).toContain(
          "The learner opened Nina from question 3 of their finished try-out review."
        );
        expect(prompt).toContain("- question language: id");
        expect(prompt).toContain("- learner result: answered incorrectly");
        expect(prompt).toContain(
          "## Answer Choices\n\n- Empat (correct answer)\n- Lima (learner's choice)\n- Tiga"
        );
        expect(prompt).toContain("Jumlahkan kedua bilangan.");
        expect(prompt.indexOf("## Question")).toBeLessThan(
          prompt.indexOf("## Official Explanation")
        );
      })
  );

  it.effect(
    "marks a correct multiple-choice answer on every chosen option",
    () =>
      Effect.gen(function* () {
        const prompt = yield* formatFocusPrompt({
          ...choice,
          responseSpec: {
            kind: "multiple-choice",
            options: [
              { isCorrect: true, label: "Genap", optionKey: "a", order: 1 },
              { isCorrect: true, label: "Positif", optionKey: "b", order: 2 },
            ],
          },
          selection: { kind: "multiple-choice", optionKeys: ["a", "b"] },
          isCorrect: true,
        });

        expect(prompt).toContain("- learner result: answered correctly");
        expect(prompt).toContain(
          "- Genap (correct answer, learner's choice)\n- Positif (correct answer, learner's choice)"
        );
      })
  );

  it.effect(
    "lists category statements with the correct and the learner's category",
    () =>
      Effect.gen(function* () {
        const prompt = yield* formatFocusPrompt({
          ...choice,
          responseSpec: {
            kind: "category",
            categories: [
              { categoryKey: "true", label: "Benar", order: 1 },
              { categoryKey: "false", label: "Salah", order: 2 },
            ],
            statements: [
              {
                correctCategoryKey: "false",
                label: "Dua kali dua adalah lima.",
                order: 2,
                statementKey: "two",
              },
              {
                correctCategoryKey: "true",
                label: "Dua ditambah dua adalah empat.",
                order: 1,
                statementKey: "one",
              },
            ],
          },
          selection: {
            kind: "category",
            assignments: [{ categoryKey: "true", statementKey: "one" }],
          },
        });

        expect(prompt).toContain(
          [
            "- Dua ditambah dua adalah empat.",
            "  - correct category: Benar",
            "  - learner's category: Benar",
            "- Dua kali dua adalah lima.",
            "  - correct category: Salah",
            "  - learner's category: no answer",
          ].join("\n")
        );
      })
  );

  it.effect("lists an unanswered category question without learner picks", () =>
    Effect.gen(function* () {
      const prompt = yield* formatFocusPrompt({
        ...choice,
        responseSpec: {
          kind: "category",
          categories: [{ categoryKey: "true", label: "Benar", order: 1 }],
          statements: [
            {
              correctCategoryKey: "true",
              label: "Dua ditambah dua adalah empat.",
              order: 1,
              statementKey: "one",
            },
          ],
        },
        selection: null,
        isCorrect: null,
      });

      expect(prompt).toContain("- learner result: not answered");
      expect(prompt).toContain(
        [
          "- Dua ditambah dua adalah empat.",
          "  - correct category: Benar",
          "  - learner's category: no answer",
        ].join("\n")
      );
    })
  );

  it.effect("reports an unanswered question without inventing a pick", () =>
    Effect.gen(function* () {
      const prompt = yield* formatFocusPrompt({
        ...choice,
        selection: null,
        isCorrect: null,
      });

      expect(prompt).toContain("- learner result: not answered");
      expect(prompt).not.toContain("learner's choice");
    })
  );
});

describe("formatFocusTaskPrompt", () => {
  it("keeps the official explanation authoritative and quotes the exam wording", () => {
    const prompt = formatFocusTaskPrompt();

    expect(prompt).toContain("source of truth");
    expect(prompt).toContain(
      "Quote question text and choices exactly as written."
    );
    expect(prompt).toContain("not by letters or positions");
  });
});
