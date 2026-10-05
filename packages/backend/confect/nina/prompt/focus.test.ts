import { describe, expect, it } from "@effect/vitest";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type { NinaFocusSource } from "@repo/backend/confect/nina/contract/focus";
import {
  formatFocusPrompt,
  formatFocusTaskPrompt,
} from "@repo/backend/confect/nina/prompt/focus";
import { Array as Arr, Effect } from "effect";

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
  outcome: { status: "incorrect" },
} satisfies NinaFocusSource;

const indonesian = DeliveryLanguageSchema.make("id");
const label = (id: string) => ({ de: `${id} (de)`, en: `${id} (en)`, id });
const rubric = {
  ...choice,
  responseSpec: {
    criteria: [
      {
        criterionKey: "criterion-1",
        label: label("Langkah lengkap"),
        levels: [
          {
            label: label("Tidak ada"),
            levelKey: "level-1",
            order: 1,
            points: 0,
          },
          { label: label("Lengkap"), levelKey: "level-2", order: 2, points: 2 },
        ],
        order: 1,
      },
      {
        criterionKey: "criterion-2",
        finalAnswer: {
          acceptedAnswers: ["4", "empat"],
          collapseWhitespace: true,
          ignoreCase: true,
          kind: "text",
        },
        label: label("Hasil akhir"),
        levels: [
          { label: label("Salah"), levelKey: "level-1", order: 1, points: 0 },
          { label: label("Benar"), levelKey: "level-2", order: 2, points: 1 },
        ],
        order: 2,
      },
    ],
    kind: "rubric",
    language: indonesian,
  },
  selection: {
    finalAnswers: [{ criterionKey: "criterion-2", text: "4" }],
    kind: "rubric",
    text: "Dua ditambah dua.",
  },
  outcome: { status: "pending" },
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
          outcome: { status: "correct" },
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
          Arr.join(
            [
              "- Dua ditambah dua adalah empat.",
              "  - correct category: Benar",
              "  - learner's category: Benar",
              "- Dua kali dua adalah lima.",
              "  - correct category: Salah",
              "  - learner's category: no answer",
            ],
            "\n"
          )
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
        outcome: null,
      });

      expect(prompt).toContain("- learner result: not answered");
      expect(prompt).toContain(
        Arr.join(
          [
            "- Dua ditambah dua adalah empat.",
            "  - correct category: Benar",
            "  - learner's category: no answer",
          ],
          "\n"
        )
      );
    })
  );

  it.effect("reports an unanswered question without inventing a pick", () =>
    Effect.gen(function* () {
      const prompt = yield* formatFocusPrompt({
        ...choice,
        selection: null,
        outcome: null,
      });

      expect(prompt).toContain("- learner result: not answered");
      expect(prompt).not.toContain("learner's choice");
    })
  );

  it.effect("states a short-answer key beside the learner's typed answer", () =>
    Effect.gen(function* () {
      const numeric = yield* formatFocusPrompt({
        ...choice,
        responseSpec: {
          key: {
            acceptsFractions: false,
            kind: "number",
            tolerance: { kind: "absolute", value: "0.1" },
            value: "4",
          },
          kind: "short-answer",
          language: indonesian,
        },
        selection: { kind: "short-answer", number: "4.5", text: "4,5" },
        outcome: { status: "incorrect" },
      });
      const blank = yield* formatFocusPrompt({
        ...choice,
        responseSpec: {
          key: {
            acceptsFractions: false,
            kind: "number",
            value: "4",
          },
          kind: "short-answer",
          language: indonesian,
        },
        selection: null,
        outcome: null,
      });

      expect(numeric).toContain(
        "## Answer Key\n\n- correct number: 4 (absolute tolerance 0.1)\n- learner's answer: 4,5"
      );
      expect(blank).toContain(
        "- correct number: 4\n- learner's answer: no answer"
      );
    })
  );

  it.effect(
    "lists rubric criteria, final-answer keys, and the written answer",
    () =>
      Effect.gen(function* () {
        const prompt = yield* formatFocusPrompt(rubric);

        expect(prompt).toContain(
          "- learner result: answered, awaiting grading"
        );
        expect(prompt).toContain(
          Arr.join(
            [
              "## Rubric",
              "",
              "- Langkah lengkap",
              "  - 0 points: Tidak ada",
              "  - 2 points: Lengkap",
              "- Hasil akhir",
              "  - 0 points: Salah",
              "  - 1 points: Benar",
              "  - accepted answers: 4; empat",
              "  - learner's final answer: 4",
              "",
              "## Learner's Written Answer",
              "",
              "Dua ditambah dua.",
            ],
            "\n"
          )
        );
      })
  );

  it.effect("reports partial credit and an unanswered rubric", () =>
    Effect.gen(function* () {
      const partial = yield* formatFocusPrompt({
        ...rubric,
        selection: { finalAnswers: [], kind: "rubric", text: " " },
        outcome: { points: 1, status: "partial" },
      });
      const unanswered = yield* formatFocusPrompt({
        ...rubric,
        selection: null,
        outcome: null,
      });

      expect(partial).toContain(
        "- learner result: partially correct, earning 1 points"
      );
      expect(partial).toContain("  - learner's final answer: no answer");
      expect(partial).toContain("no written answer");
      expect(unanswered).toContain("no written answer");
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
