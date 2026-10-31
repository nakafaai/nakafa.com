import { describe, expect, it } from "@effect/vitest";
import type { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  choiceAnswers,
  essayAnswers,
  matchAnswers,
  shortAnswers,
  tableAnswers,
  textLabel,
} from "@repo/backend/confect/exams/blank";
import {
  labelEmpty,
  paperAnswers,
  partsEmpty,
  promptEmpty,
  questionGap,
} from "@repo/backend/confect/exams/parts";
import { EMPTY_PROMPT_TEXT } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";

/** The label of a new part, which holds one empty paragraph until the teacher writes it. */
const EMPTY: typeof ContentDocumentSchema.Type = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

/** The label that reads `text`, or the empty label for no text. */
const labelOf = (text: string) => (text === "" ? EMPTY : textLabel(text));

/** A table of a true and a false column, whose statements read `texts`. */
const tableOf = (
  texts: readonly [string, ...string[]]
): Extract<Interaction, { kind: "matrix" }> => {
  const [table] = tableAnswers(["Benar", "Salah"]);
  const [first, ...rest] = texts;
  return {
    ...table,
    statements: [
      { id: "statement-1", label: labelOf(first) },
      ...Arr.map(rest, (text, index) => ({
        id: `statement-${index + 2}`,
        label: labelOf(text),
      })),
    ],
  };
};

/** A matching whose statements read `sources` and whose answers read `targets`. */
const matchOf = (
  sources: readonly [string, ...string[]],
  targets: readonly [string, ...string[]]
): Extract<Interaction, { kind: "match" }> => {
  const [match] = matchAnswers();
  const side = (texts: readonly [string, ...string[]], prefix: string) => {
    const [first, ...rest] = texts;
    return [
      { id: `${prefix}-1`, label: labelOf(first), maxMatches: 1 },
      ...Arr.map(rest, (text, index) => ({
        id: `${prefix}-${index + 2}`,
        label: labelOf(text),
        maxMatches: 1,
      })),
    ] as const;
  };
  return {
    ...match,
    sources: side(sources, "source"),
    targets: side(targets, "target"),
  };
};

describe("exams/parts labelEmpty", () => {
  it("finds a label empty when its paragraphs hold only spaces and line breaks", () => {
    expect(labelEmpty(EMPTY)).toBe(true);
    expect(labelEmpty({ content: [{ type: "paragraph" }], type: "doc" })).toBe(
      true
    );
    expect(
      labelEmpty({
        content: [
          {
            content: [{ text: "  ", type: "text" }, { type: "hardBreak" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      })
    ).toBe(true);
  });

  it("finds words, a formula, or any block but a paragraph something to show", () => {
    expect(labelEmpty(textLabel("144"))).toBe(false);
    expect(
      labelEmpty({
        content: [
          {
            content: [{ attrs: { latex: "x^2" }, type: "mathInline" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      })
    ).toBe(false);
    expect(
      labelEmpty({
        content: [{ attrs: { latex: "\\frac{1}{2}" }, type: "mathBlock" }],
        type: "doc",
      })
    ).toBe(false);
  });
});

describe("exams/parts partsEmpty", () => {
  it("finds an empty option, statement, column, or side of a pair", () => {
    expect(partsEmpty(choiceAnswers([textLabel("144"), EMPTY]))).toBe(true);
    expect(partsEmpty(tableAnswers(["Benar", "Salah"]))).toBe(true);
    expect(partsEmpty([tableOf(["Air mendidih pada 100 °C."])])).toBe(false);
    expect(
      partsEmpty([
        {
          ...tableOf(["Air mendidih pada 100 °C."]),
          columns: [
            { id: "column-1", label: textLabel("Benar") },
            { id: "column-2", label: EMPTY },
          ],
        },
      ])
    ).toBe(true);
    expect(partsEmpty([matchOf(["Jakarta"], ["Indonesia"])])).toBe(false);
    expect(partsEmpty([matchOf(["Jakarta"], [""])])).toBe(true);
  });

  it("finds nothing empty in a written choice, a short answer, or an essay", () => {
    expect(
      partsEmpty(choiceAnswers([textLabel("144"), textLabel("124")]))
    ).toBe(false);
    expect(partsEmpty(shortAnswers())).toBe(false);
    expect(partsEmpty(essayAnswers())).toBe(false);
  });
});

describe("exams/parts paperAnswers", () => {
  it("leaves the empty options out of a choice, and keeps the IDs of the rest", () => {
    const [choice] = paperAnswers(
      choiceAnswers([textLabel("144"), EMPTY, textLabel("124"), EMPTY])
    );
    expect(choice).toMatchObject({
      kind: "choice",
      options: [
        { id: "option-1", label: textLabel("144") },
        { id: "option-3", label: textLabel("124") },
      ],
    });
  });

  it("leaves the empty statements out of a table, and the whole table once none is written", () => {
    expect(
      paperAnswers([tableOf(["Air mendidih pada 100 °C.", ""])])
    ).toMatchObject([
      {
        columns: [{ id: "column-1" }, { id: "column-2" }],
        kind: "matrix",
        statements: [{ id: "statement-1" }],
      },
    ]);
    expect(paperAnswers(tableAnswers(["Benar", "Salah"]))).toEqual([]);
  });

  it("leaves the empty sides out of a matching, and the whole matching once a side has nothing written", () => {
    expect(
      paperAnswers([matchOf(["Jakarta", ""], ["Indonesia", "Jepang"])])
    ).toMatchObject([
      {
        kind: "match",
        sources: [{ id: "source-1" }],
        targets: [{ id: "target-1" }, { id: "target-2" }],
      },
    ]);
    expect(paperAnswers([matchOf(["Jakarta"], [""])])).toEqual([]);
    expect(paperAnswers(matchAnswers())).toEqual([]);
  });

  it("keeps a short answer and an essay as they are", () => {
    expect(paperAnswers(shortAnswers())).toEqual(shortAnswers());
    expect(paperAnswers(essayAnswers())).toEqual(essayAnswers());
  });
});

describe("exams/parts questionGap", () => {
  const written = choiceAnswers([textLabel("144"), textLabel("124")]);
  const marked = [
    { correct: ["option-1"], interaction: "choice", kind: "choice" as const },
  ] as const;

  it("names an empty part before a missing key, since the options are written before one is marked", () => {
    expect(
      questionGap({
        answers: choiceAnswers([textLabel("144"), EMPTY]),
        key: null,
        template: "choice",
      })
    ).toEqual(Option.some("empty"));
    expect(
      questionGap({ answers: written, key: null, template: "choice" })
    ).toEqual(Option.some("key"));
  });

  it("finds a written, keyed question ready, and an essay ready without a key", () => {
    expect(
      questionGap({ answers: written, key: marked, template: "choice" })
    ).toEqual(Option.none());
    expect(
      questionGap({ answers: essayAnswers(), key: null, template: "essay" })
    ).toEqual(Option.none());
  });
});

describe("exams/parts promptEmpty", () => {
  it("reads a prompt of blank paragraphs as empty, and any words or a block as written", () => {
    expect(promptEmpty(EMPTY_PROMPT_TEXT)).toBe(true);
    expect(
      promptEmpty(
        '{"content":[{"content":[{"text":"  ","type":"text"}],"type":"paragraph"}],"type":"doc"}'
      )
    ).toBe(true);
    expect(
      promptEmpty(
        '{"content":[{"content":[{"text":"Soal","type":"text"}],"type":"paragraph"}],"type":"doc"}'
      )
    ).toBe(false);
    expect(promptEmpty('{"content":[{"type":"rule"}],"type":"doc"}')).toBe(
      false
    );
  });
});
