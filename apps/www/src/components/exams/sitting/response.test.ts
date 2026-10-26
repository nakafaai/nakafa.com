import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { Option, Schema } from "effect";
import {
  choiceOf,
  entryOf,
  toggleOption,
} from "@/components/exams/sitting/response";

const decodeInteraction = Schema.decodeUnknownSync(InteractionSchema);

/** A document with one paragraph of text, which an option label holds. */
function label(text: string) {
  return {
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  };
}

/** A choice with the given number of options, which a student picks from. */
function choice(maxChoices: number) {
  return decodeInteraction({
    id: "choice-a",
    kind: "choice",
    label: "Pick",
    maxChoices,
    minChoices: 1,
    options: [
      { id: "option-1", label: label("One") },
      { id: "option-2", label: label("Two") },
      { id: "option-3", label: label("Three") },
    ],
    shuffle: false,
  });
}

describe("choiceOf", () => {
  it("returns the choice of a question that holds one choice", () => {
    const found = choiceOf([choice(1)]);

    expect(Option.isSome(found)).toBe(true);
  });

  it("returns none for a question that holds another interaction", () => {
    const found = choiceOf([
      decodeInteraction({
        id: "entry-a",
        kind: "textEntry",
        label: "Answer",
      }),
    ]);

    expect(Option.isNone(found)).toBe(true);
  });

  it("returns none for a question that holds more than one interaction", () => {
    const found = choiceOf([choice(1), choice(1)]);

    expect(Option.isNone(found)).toBe(true);
  });
});

describe("toggleOption", () => {
  it("adds a checked option while the response holds fewer than the maximum", () => {
    expect(toggleOption([], "option-1", true, 2)).toEqual(["option-1"]);
  });

  it("keeps the response as it was when a check goes beyond the maximum", () => {
    const response = ["option-1", "option-2"];

    expect(toggleOption(response, "option-3", true, 2)).toBe(response);
  });

  it("keeps an option that is already chosen once", () => {
    const response = ["option-1"];

    expect(toggleOption(response, "option-1", true, 2)).toBe(response);
  });

  it("removes an unchecked option and keeps the others", () => {
    expect(
      toggleOption(["option-1", "option-2"], "option-1", false, 2)
    ).toEqual(["option-2"]);
  });

describe("entryOf", () => {
  /** A short answer's text entry, which a student types into. */
  const entry = decodeInteraction({
    id: "entry",
    kind: "textEntry",
    label: "Answer",
  });

  it("finds the text entry of a question that holds only it", () => {
    expect(entryOf([entry])).toEqual(Option.some(entry));
  });

  it("finds no text entry in a choice, or in a question of two interactions", () => {
    expect(entryOf([choice(1)])).toEqual(Option.none());
    expect(entryOf([entry, choice(1)])).toEqual(Option.none());
  });
});
