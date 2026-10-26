import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option } from "effect";
import {
  acceptedKey,
  acceptedOf,
  changedOption,
  choiceOf,
  emptyLabel,
  entryOf,
  holdsLabel,
  keyWithoutOption,
  labelText,
  markedKey,
  markedOptions,
  type OptionLabel,
  optionEditOf,
  optionLabelOf,
  optionLetter,
  toggledKey,
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

describe("holdsLabel", () => {
  it("holds the label that the editor's document reads as", () => {
    expect(holdsLabel(textOf("Paris"), textOf("Paris"))).toBe(true);
  });

  it("holds no label that the editor has typed past", () => {
    expect(holdsLabel(textOf("Lyon"), textOf("Paris"))).toBe(false);
  });

  it("holds no label in a document the contract refuses", () => {
    expect(
      holdsLabel(
        { content: [{ type: "unknownBlock" }], type: "doc" },
        textOf("Paris")
      )
    ).toBe(false);
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

describe("markedOptions", () => {
  it("reads the options that the key marks", () => {
    expect(markedOptions(markedKey([choice], "option-2"))).toEqual([
      "option-2",
    ]);
  });

  it("reads no option while there is no key", () => {
    expect(markedOptions(null)).toEqual([]);
  });

  it("reads no option from a key that marks no choice", () => {
    const key: readonly InteractionKey[] = [
      {
        interaction: "math",
        kind: "mathEntry",
        expression: "x^2",
      },
    ];

    expect(markedOptions(key)).toEqual([]);
  });

  it("reads the options of the choice among other answers", () => {
    const key: readonly InteractionKey[] = [
      { interaction: "math", kind: "mathEntry", expression: "x" },
      {
        correct: ["option-1", "option-3"],
        interaction: "choice",
        kind: "choice",
      },
    ];

    expect(markedOptions(key)).toEqual(["option-1", "option-3"]);
  });
});

describe("changedOption", () => {
  it("reads the option that joined the marked ones", () => {
    expect(changedOption(["option-1"], ["option-1", "option-3"])).toEqual(
      Option.some("option-3")
    );
  });

  it("reads the option that left the marked ones", () => {
    expect(changedOption(["option-1", "option-3"], ["option-3"])).toEqual(
      Option.some("option-1")
    );
  });

  it("reads no option when the same options stay marked", () => {
    expect(changedOption(["option-2"], ["option-2"])).toEqual(Option.none());
  });
});

describe("toggledKey", () => {
  /** A complex choice, which takes every option it holds. */
  const choices = { ...choice, maxChoices: 4 };

  it("marks a new option beside the others, in the order of the choice", () => {
    const key = toggledKey(
      [choices],
      markedKey([choices], "option-3"),
      "option-1"
    );

    expect(key).toEqual([
      {
        correct: ["option-1", "option-3"],
        interaction: "choice",
        kind: "choice",
      },
    ]);
  });

  it("marks the first option of a question without a key", () => {
    expect(toggledKey([choices], null, "option-2")).toEqual(
      markedKey([choices], "option-2")
    );
  });

  it("unmarks a marked option and keeps the rest", () => {
    const key = toggledKey(
      [choices],
      toggledKey([choices], markedKey([choices], "option-1"), "option-4"),
      "option-1"
    );

    expect(key).toEqual(markedKey([choices], "option-4"));
  });

  it("clears the key once its last option is unmarked", () => {
    expect(
      toggledKey([choices], markedKey([choices], "option-2"), "option-2")
    ).toBeNull();
  });

  it("keeps the marks in the order given when the answers hold no choice", () => {
    expect(toggledKey([entry], null, "option-2")).toEqual([
      { correct: ["option-2"], interaction: "entry", kind: "choice" },
    ]);
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

  it("lets a complex choice take the new option too", () => {
    const choices = { ...choice, maxChoices: 4 };
    expect(withOptionAdded([choices])).toEqual([
      {
        ...choices,
        maxChoices: 5,
        options: [...choices.options, { id: "option-5", label: emptyLabel() }],
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

  it("lets a complex choice take one option fewer", () => {
    const choices = { ...choice, maxChoices: 4 };
    expect(withOptionRemoved([choices], "option-4")).toEqual([
      { ...choices, maxChoices: 3, options: Arr.take(choice.options, 3) },
    ]);
  });

  it("keeps the other correct options of a complex choice when one is removed", () => {
    const key = toggledKey(
      [choice],
      markedKey([choice], "option-1"),
      "option-3"
    );
    expect(keyWithoutOption(key, "option-1")).toEqual(
      markedKey([choice], "option-3")
    );
  });

  it("keeps the answers of other interactions when an option leaves the key", () => {
    const math: InteractionKey = {
      expression: "x",
      interaction: "math",
      kind: "mathEntry",
    };
    const key = toggledKey(
      [choice],
      markedKey([choice], "option-1"),
      "option-3"
    );
    expect(
      keyWithoutOption(key === null ? null : [math, ...key], "option-1")
    ).toEqual([math, ...markedKey([choice], "option-3")]);
  });

  it("leaves a choice of two options as it is", () => {
    const pair = { ...choice, options: [choice.options[0], choice.options[1]] };
    expect(withOptionRemoved([pair, entry], "option-2")).toEqual([pair, entry]);
  });
});

describe("entryOf, acceptedKey and acceptedOf", () => {
  it("finds the text entry of a short answer, and none in a choice", () => {
    expect(entryOf([entry])).toEqual(Option.some(entry));
    expect(entryOf([choice])).toEqual(Option.none());
  });

  it("accepts each text once, cleaned as the contract takes it, ignoring case and extra spaces", () => {
    const key = acceptedKey(
      [entry],
      [" Jakarta ", "jakarta", "DKI\u00a0 Jakarta", "", "Batavia\u200b"]
    );
    expect(key).toEqual([
      {
        accepted: {
          acceptedAnswers: ["Jakarta", "DKI Jakarta", "Batavia"],
          collapseWhitespace: true,
          ignoreCase: true,
          kind: "text",
        },
        interaction: "entry",
        kind: "textEntry",
      },
    ]);
    expect(acceptedOf(key)).toEqual(["Jakarta", "DKI Jakarta", "Batavia"]);
  });

  it("clears the key when no text is left, and reads no accepted answer from a choice key or none", () => {
    expect(acceptedKey([entry], ["  ", ""])).toBeNull();
    expect(acceptedOf(null)).toEqual([]);
    expect(acceptedOf(markedKey([choice], "option-1"))).toEqual([]);
  });
});

describe("labelText", () => {
  it("reads the text of a label's paragraphs, and nothing of an empty one", () => {
    expect(labelText(textOf("Benar"))).toBe("Benar");
    expect(
      labelText({
        content: [
          { content: [{ text: "Salah", type: "text" }], type: "paragraph" },
          { content: [{ text: "sekali", type: "text" }], type: "paragraph" },
        ],
        type: "doc",
      })
    ).toBe("Salah sekali");
    expect(labelText(emptyLabel())).toBe("");
  });
});
