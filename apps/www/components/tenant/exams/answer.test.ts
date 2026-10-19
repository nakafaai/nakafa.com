import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option } from "effect";
import {
  choiceOf,
  keyWithoutOption,
  labelText,
  markedKey,
  markedOption,
  optionLetter,
  textLabel,
  withOptionAdded,
  withOptionRemoved,
  withOptionText,
} from "@/components/tenant/exams/answer";

/** One single-answer choice with four options, the shape a new school question takes. */
const choice: Interaction = {
  id: "choice",
  kind: "choice",
  label: "Answer",
  maxChoices: 1,
  minChoices: 1,
  options: [
    { id: "option-1", label: textLabel("") },
    { id: "option-2", label: textLabel("Paris") },
    { id: "option-3", label: textLabel("Rome") },
    { id: "option-4", label: textLabel("Berlin") },
  ],
  shuffle: false,
};

/** A text entry, which is not a choice, so an answer edit leaves it as it is. */
const entry: Interaction = { id: "entry", kind: "textEntry", label: "Entry" };

describe("optionLetter", () => {
  it("names the options from A in order", () => {
    expect(optionLetter(0)).toBe("A");
    expect(optionLetter(3)).toBe("D");
  });
});

describe("labelText and textLabel", () => {
  it("reads back the text that a label was written with", () => {
    expect(labelText(textLabel("Paris"))).toBe("Paris");
  });

  it("writes an empty text as one empty paragraph", () => {
    expect(textLabel("")).toEqual({
      content: [{ type: "paragraph" }],
      type: "doc",
    });
    expect(labelText(textLabel(""))).toBe("");
  });

  it("reads no text from a block that is not a paragraph", () => {
    expect(
      labelText({
        content: [
          {
            attrs: { level: 1 },
            content: [{ text: "Heading", type: "text" }],
            type: "heading",
          },
        ],
        type: "doc",
      })
    ).toBe("");
  });

  it("reads no text from an inline node that is not text", () => {
    expect(
      labelText({
        content: [
          {
            content: [{ attrs: { latex: "x^2" }, type: "mathInline" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      })
    ).toBe("");
  });
});

describe("choiceOf", () => {
  it("finds the choice of the answers", () => {
    expect(choiceOf([entry, choice])).toEqual(Option.some(choice));
  });

  it("finds no choice when the answers hold none", () => {
    expect(choiceOf([entry])).toEqual(Option.none());
  });
});

/** The text of each option of the first choice of the answers, in order. */
const optionTexts = (answers: readonly Interaction[]) =>
  Arr.flatMap(answers, (answer) =>
    answer.kind === "choice"
      ? Arr.map(answer.options, (option) => labelText(option.label))
      : []
  );

describe("withOptionText", () => {
  it("replaces the text of the named option and keeps the rest", () => {
    const answers = withOptionText([choice, entry], "option-2", "Lyon");
    const [first, second] = answers;

    expect(second).toBe(entry);
    expect(first.id).toBe("choice");
    expect(optionTexts(answers)).toEqual(["", "Lyon", "Rome", "Berlin"]);
  });

  it("keeps the options in their order and their IDs", () => {
    const answers = withOptionText([choice], "option-4", "Madrid");

    expect(
      Arr.flatMap(answers, (answer) =>
        answer.kind === "choice"
          ? Arr.map(answer.options, (option) => option.id)
          : []
      )
    ).toEqual(["option-1", "option-2", "option-3", "option-4"]);
    expect(optionTexts(answers)).toEqual(["", "Paris", "Rome", "Madrid"]);
  });
});

describe("markedKey", () => {
  it("marks the named option correct for each interaction", () => {
    const key = markedKey([choice], "option-3");

    expect(key).toEqual([
      { correct: ["option-3"], interaction: "choice", kind: "choice" },
    ]);
  });
});

describe("markedOption", () => {
  it("reads the option that the key marks", () => {
    expect(markedOption(markedKey([choice], "option-2"))).toBe("option-2");
  });

  it("reads no option while there is no key", () => {
    expect(markedOption(null)).toBeNull();
  });

  it("reads no option from a key that marks no choice", () => {
    const key: readonly InteractionKey[] = [
      {
        interaction: "math",
        kind: "mathEntry",
        expression: "x^2",
      },
    ];

    expect(markedOption(key)).toBeNull();
  });

  it("reads the option of the choice among other answers", () => {
    const key: readonly InteractionKey[] = [
      { interaction: "math", kind: "mathEntry", expression: "x" },
      { correct: ["option-1"], interaction: "choice", kind: "choice" },
    ];

    expect(markedOption(key)).toBe("option-1");
  });
});

describe("withOptionAdded", () => {
  it("adds an empty option after the last one, numbered after the largest option ID the choice holds", () => {
    const sparse = {
      ...choice,
      options: [choice.options[0], choice.options[2]],
    };
    expect(withOptionAdded([sparse])).toEqual([
      {
        ...sparse,
        options: [...sparse.options, { id: "option-4", label: textLabel("") }],
      },
    ]);
  });

  it("numbers the new option from one when no option ID holds a number", () => {
    const named = {
      ...choice,
      options: [
        { id: "first", label: textLabel("") },
        { id: "second", label: textLabel("") },
      ],
    };
    expect(withOptionAdded([named])).toEqual([
      {
        ...named,
        options: [...named.options, { id: "option-1", label: textLabel("") }],
      },
    ]);
  });

  it("leaves a choice of five options and a text entry as they are", () => {
    const full = {
      ...choice,
      options: [...choice.options, { id: "option-5", label: textLabel("") }],
    };
    expect(withOptionAdded([full, entry])).toEqual([full, entry]);
  });
});

describe("withOptionRemoved", () => {
  it("takes the option out of each choice and leaves the other answers", () => {
    expect(withOptionRemoved([choice, entry], "option-2")).toEqual([
      {
        ...choice,
        options: [choice.options[0], choice.options[2], choice.options[3]],
      },
      entry,
    ]);
  });

  it("keeps the key that marks another option, and clears the key that marks the removed one", () => {
    const key = markedKey([choice], "option-3");
    expect(keyWithoutOption(key, "option-2")).toEqual(key);
    expect(
      keyWithoutOption(markedKey([choice], "option-2"), "option-2")
    ).toBeNull();
    expect(keyWithoutOption(null, "option-2")).toBeNull();
  });

  it("leaves a choice of two options as it is", () => {
    const pair = { ...choice, options: [choice.options[0], choice.options[1]] };
    expect(withOptionRemoved([pair, entry], "option-2")).toEqual([pair, entry]);
  });
});
