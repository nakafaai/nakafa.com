import { describe, expect, it } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { Option, Schema } from "effect";
import {
  choiceOf,
  pairedWith,
  pairingOf,
  writtenOf,
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

describe("writtenOf", () => {
  /** A short answer's text entry, which a student types into. */
  const entry = decodeInteraction({
    id: "entry",
    kind: "textEntry",
    label: "Answer",
  });

  /** An essay's long text, which a student writes in. */
  const essay = decodeInteraction({
    id: "essay",
    kind: "extendedText",
    label: "Answer",
  });

  it("finds the text entry or the long text of a question that holds only it", () => {
    expect(writtenOf([entry])).toEqual(Option.some(entry));
    expect(writtenOf([essay])).toEqual(Option.some(essay));
  });

  it("finds nothing written in a choice, or in a question of two interactions", () => {
    expect(writtenOf([choice(1)])).toEqual(Option.none());
    expect(writtenOf([entry, choice(1)])).toEqual(Option.none());
  });
});

describe("pairedWith", () => {
  /** A match of three statements, whose order the pairs keep. */
  const match = { sources: [{ id: "source-1" }, { id: "source-2" }, { id: "source-3" }] };

  it("pairs a statement with an answer, which another statement gives up, in the order of the statements", () => {
    const one = pairedWith(match.sources, [], { source: "source-2", target: "target-1" });
    expect(one).toEqual([{ source: "source-2", target: "target-1" }]);
    expect(
      pairedWith(match.sources, one, { source: "source-1", target: "target-1" })
    ).toEqual([{ source: "source-1", target: "target-1" }]);
    expect(
      pairedWith(match.sources, one, { source: "source-1", target: "target-3" })
    ).toEqual([
      { source: "source-1", target: "target-3" },
      { source: "source-2", target: "target-1" },
    ]);
  });

  it("drops a pair of a statement that the match does not hold", () => {
    expect(
      pairedWith(match.sources, [], { source: "source-9", target: "target-1" })
    ).toEqual([]);
  });
});

describe("pairingOf", () => {
  /** A match, which a matching question holds alone. */
  const match = decodeInteraction({
    id: "match",
    kind: "match",
    label: "Pairs",
    shuffle: false,
    sources: [
      { id: "source-1", label: label("Ibu kota"), maxMatches: 1 },
      { id: "source-2", label: label("Mata uang"), maxMatches: 1 },
    ],
    targets: [
      { id: "target-1", label: label("Jakarta"), maxMatches: 1 },
      { id: "target-2", label: label("Rupiah"), maxMatches: 1 },
    ],
  });

  it("finds the match of a question that holds only it, and none beside a choice", () => {
    expect(pairingOf([match])).toEqual(Option.some(match));
    expect(pairingOf([match, choice(1)])).toEqual(Option.none());
    expect(pairingOf([choice(1)])).toEqual(Option.none());
  });
});
