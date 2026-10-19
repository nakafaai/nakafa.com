import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option } from "effect";
import {
  choiceOf,
  emptyLabel,
  keyWithoutOption,
  markedKey,
  markedOption,
  type OptionLabel,
  optionEditOf,
  optionLabelOf,
  optionLetter,
  withOptionAdded,
  withOptionLabel,
  withOptionRemoved,
} from "@/components/tenant/exams/answer";

/** The label of an option that holds `text` as one paragraph, the shape the option editor writes. */
const textOf = (text: string): OptionLabel => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** The text of a label, read from the text of its paragraphs in order. */
const plainText = (label: OptionLabel) =>
  Arr.join(
    Arr.flatMap(label.content, (block) =>
      block.type === "paragraph"
        ? Arr.flatMap(block.content ?? [], (node) =>
            node.type === "text" ? [node.text] : []
          )
        : []
    ),
    ""
  );

/** One single-answer choice with four options, the shape a new school question takes. */
const choice: Interaction = {
  id: "choice",
  kind: "choice",
  label: "Answer",
  maxChoices: 1,
  minChoices: 1,
  options: [
    { id: "option-1", label: emptyLabel() },
    { id: "option-2", label: textOf("Paris") },
    { id: "option-3", label: textOf("Rome") },
    { id: "option-4", label: textOf("Berlin") },
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

describe("optionLabelOf and emptyLabel", () => {
  it("reads a label the contract accepts as the document it is", () => {
    expect(optionLabelOf(textOf("Paris"))).toEqual(
      Option.some(textOf("Paris"))
    );
  });

  it("reads no label from a document the contract refuses", () => {
    expect(
      optionLabelOf({ content: [{ type: "unknownBlock" }], type: "doc" })
    ).toEqual(Option.none());
  });

  it("writes an empty label as one empty paragraph", () => {
    expect(emptyLabel()).toEqual({
      content: [{ type: "paragraph" }],
      type: "doc",
    });
    expect(plainText(emptyLabel())).toBe("");
  });
});

describe("optionEditOf", () => {
  const refused = { content: [{ type: "unknownBlock" }], type: "doc" };

  it("reads no edit from a change that edits no text, such as the editor's lock", () => {
    expect(optionEditOf({ docChanged: false, json: textOf("Paris") })).toEqual(
      Option.none()
    );
  });

  it("reads no refusal from a change that edits no text, even when its document is refused", () => {
    expect(optionEditOf({ docChanged: false, json: refused })).toEqual(
      Option.none()
    );
  });

  it("reads the label the teacher typed when the contract takes it", () => {
    expect(optionEditOf({ docChanged: true, json: textOf("Paris") })).toEqual(
      Option.some({ kind: "typed", label: textOf("Paris") })
    );
  });

  it("reads a refusal when the typed text is one the contract refuses", () => {
    expect(optionEditOf({ docChanged: true, json: refused })).toEqual(
      Option.some({ kind: "refused" })
    );
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
      ? Arr.map(answer.options, (option) => plainText(option.label))
      : []
  );

describe("withOptionLabel", () => {
  it("replaces the label of the named option with the document and keeps the rest", () => {
    const answers = withOptionLabel(
      [choice, entry],
      "option-2",
      textOf("Lyon")
    );
    const [first, second] = answers;

    expect(second).toBe(entry);
    expect(first.id).toBe("choice");
    expect(optionTexts(answers)).toEqual(["", "Lyon", "Rome", "Berlin"]);
  });

  it("keeps every formatted node of the document it writes", () => {
    const bold: OptionLabel = {
      content: [
        {
          content: [
            { marks: [{ type: "bold" }], text: "Paris", type: "text" },
            { text: " is the capital", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    };

    const [answer] = withOptionLabel([choice], "option-2", bold);

    expect(answer.kind === "choice" ? answer.options[1].label : null).toEqual(
      bold
    );
  });

  it("keeps the options in their order and their IDs", () => {
    const answers = withOptionLabel([choice], "option-4", textOf("Madrid"));

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
        options: [...sparse.options, { id: "option-4", label: emptyLabel() }],
      },
    ]);
  });

  it("numbers the new option from one when no option ID holds a number", () => {
    const named = {
      ...choice,
      options: [
        { id: "first", label: emptyLabel() },
        { id: "second", label: emptyLabel() },
      ],
    };
    expect(withOptionAdded([named])).toEqual([
      {
        ...named,
        options: [...named.options, { id: "option-1", label: emptyLabel() }],
      },
    ]);
  });

  it("leaves a choice of five options and a text entry as they are", () => {
    const full = {
      ...choice,
      options: [...choice.options, { id: "option-5", label: emptyLabel() }],
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
