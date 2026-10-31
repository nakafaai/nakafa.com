import { describe, expect, it } from "@effect/vitest";
import { fitsQuestion } from "@repo/backend/confect/assessment/fit";
import { TEXT_RESPONSE_MAX } from "@repo/backend/confect/assessment/response";
import {
  essayAnswers,
  matchAnswers,
  newChoiceAnswers,
  numericAnswers,
  shortAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/question";

describe("exams/sittings fitsQuestion", () => {
  it("takes the options of a choice within its count, and refuses an unknown, a repeated or a typed one", () => {
    const choice = newChoiceAnswers();

    expect(fitsQuestion(choice, ["option-2"])).toBe(true);
    expect(fitsQuestion(choice, [])).toBe(false);
    expect(fitsQuestion(choice, ["option-9"])).toBe(false);
    expect(fitsQuestion(choice, ["option-1", "option-1"])).toBe(false);
    expect(fitsQuestion(choice, ["option-1", "option-2"])).toBe(false);
    expect(fitsQuestion(choice, { text: "B" })).toBe(false);
  });

  it("takes one line of text in a short answer, blank included, and refuses a longer line or options", () => {
    const entry = shortAnswers();

    expect(fitsQuestion(entry, { text: "Jakarta" })).toBe(true);
    expect(fitsQuestion(entry, { text: "" })).toBe(true);
    expect(
      fitsQuestion(entry, { text: "a".repeat(TEXT_RESPONSE_MAX + 1) })
    ).toBe(false);
    expect(fitsQuestion(entry, ["option-1"])).toBe(false);
  });

  it("takes one line of typed number in a numeric answer, any text included, and refuses a longer line or options", () => {
    const number = numericAnswers();

    expect(fitsQuestion(number, { text: "0,75" })).toBe(true);
    expect(fitsQuestion(number, { text: "tiga" })).toBe(true);
    expect(
      fitsQuestion(number, { text: "1".repeat(TEXT_RESPONSE_MAX + 1) })
    ).toBe(false);
    expect(fitsQuestion(number, ["option-1"])).toBe(false);
  });

  it("takes written text in an essay, past a short answer's length", () => {
    expect(
      fitsQuestion(essayAnswers(), { text: "a".repeat(TEXT_RESPONSE_MAX + 1) })
    ).toBe(true);
    expect(
      fitsQuestion(essayAnswers(), {
        pairs: [{ source: "source-1", target: "target-1" }],
      })
    ).toBe(false);
  });

  it("takes some pairs of a match, and refuses an answer paired twice or an unknown statement", () => {
    const match = matchAnswers();

    expect(
      fitsQuestion(match, {
        pairs: [{ source: "source-1", target: "target-2" }],
      })
    ).toBe(true);
    expect(
      fitsQuestion(match, {
        pairs: [
          { source: "source-1", target: "target-2" },
          { source: "source-2", target: "target-2" },
        ],
      })
    ).toBe(false);
    expect(
      fitsQuestion(match, {
        pairs: [{ source: "source-9", target: "target-1" }],
      })
    ).toBe(false);
    expect(fitsQuestion(match, { text: "Jakarta" })).toBe(false);
  });

  it("takes the cells of a table, and refuses a statement marked twice", () => {
    const table = tableAnswers(["Benar", "Salah"]);

    expect(
      fitsQuestion(table, {
        cells: [{ column: "column-2", statement: "statement-1" }],
      })
    ).toBe(true);
    expect(
      fitsQuestion(table, {
        cells: [
          { column: "column-1", statement: "statement-1" },
          { column: "column-2", statement: "statement-1" },
        ],
      })
    ).toBe(false);
    expect(fitsQuestion(table, ["option-1"])).toBe(false);
  });

  it("takes no response to an interaction of another kind, or to a question of two interactions", () => {
    expect(
      fitsQuestion([{ id: "math", kind: "mathEntry", label: "Answer" }], {
        text: "2",
      })
    ).toBe(false);
    expect(
      fitsQuestion([...shortAnswers(), ...essayAnswers()], { text: "2" })
    ).toBe(false);
  });
});
